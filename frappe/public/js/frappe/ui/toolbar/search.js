frappe.provide('frappe.search');

frappe.search.UnifiedSearch = Class.extend({

	setup: function() {
		var d = new frappe.ui.Dialog();
		$(frappe.render_template("search")).appendTo($(d.body));
		$(d.header).html($(frappe.render_template("search_header")));

		this.search_dialog = d;
		this.search_modal = $(d.$wrapper);
		this.search_modal.addClass('search-dialog');

		this.input = this.search_modal.find(".search-input");
		this.sidebar = this.search_modal.find(".search-sidebar");
		this.results_area = this.search_modal.find(".results-area");
	},

	setup_search: function(keywords, search_objects) {
		var me = this;
		this.search_objects = search_objects;
		this.search_types = search_objects.map(function(s) {
			return s.search_type;
		});
		this.current_type = '';
		this.reset();
		this.input.val(keywords);
		this.input.on("input", function() {
			var $this = $(this);
			clearTimeout($this.data('timeout'));

			$this.data('timeout', setTimeout(function(){
				var keywords = me.input.val();
				me.reset();
				if(keywords.length > 1) {
					me.build_results(keywords);
				} else {
					me.current_type = '';
				}
			}, 250));
		});
		this.build_results(keywords);
		setTimeout(function() { me.input.select(); }, 500);
	},

	reset: function() {
		this.sidebar.empty();
		this.results_area.empty();
	},

	build_results: function(keywords) {
		var me = this;
		this.summary = $('<div class="module-body summary"></div>');
		this.full_lists = {};
		this.current = 0;
		this.search_objects[me.current].build_results_object(me, keywords);
	},

	render_results: function(results_obj, keywords){
		var me = this;
		if(this.current === 0) { this.reset() }
		this.sidebar.append(results_obj.sidelist);
		this.results_area.find('.results-status').remove();
		results_obj.sections.forEach(function(section) {
			me.summary.append(section);
		});
		this.full_lists = Object.assign(this.full_lists, results_obj.lists);
		this.render_next_search(keywords);
	},

	bind_events: function() {
		var me = this;
		this.sidebar.find('.list-link').on('click', function() {
			me.set_sidebar_link_action($(this));
		});
		this.results_area.find('.section-more').on('click', function() {
			var type = $(this).attr('data-category');
			me.sidebar.find('*[data-category="'+ type +'"]').trigger('click');
		});
	},

	set_sidebar_link_action: function(link) {
		this.sidebar.find(".list-link a").removeClass("disabled");
		link.find('a').addClass("disabled");
		var type = link.attr('data-category');
		this.results_area.empty().html(this.full_lists[type]);

		this.current_type = type;

		this.set_back_link();
		this.set_list_more_link(type);
	},

	set_back_link: function() {
		var me = this;
		var back_link = this.results_area.find('.all-results-link');
		back_link.on('click', function() {
			me.show_summary();
		});
	},

	show_summary: function() {
		this.current_type = '';
		this.results_area.empty().html(this.summary);
		this.bind_events();
	},

	set_list_more_link: function(type) {
		var me = this;
		var more_link = this.results_area.find('.list-more');
		more_link.on('click', function() {
			var more_search_type = $(this).attr('data-search');
			var s_obj = me.search_objects[me.search_types.indexOf(more_search_type)];
			s_obj.get_more_results(type);
		});
	},

	add_more_results: function(more_data) {
		var me = this;
		var more_results = more_data[0];
		var more = more_data[1];
		this.results_area.find('.list-more').before(more_results);
		if(!more) {
			this.results_area.find('.list-more').hide();
			var no_of_results = this.results_area.find('.result').length;
			var no_of_results_cue = $('<p class="results-status text-muted small">'+
				no_of_results +' results found</p>');
			this.results_area.find(".result:last").append(no_of_results_cue);
		}
		this.results_area.find('.more-results.last').slideDown(200, function() {
			var height = me.results_area.find('.module-body').height() - 750;
			if(me.results_area.find('.list-more').is(":visible")) {
				me.results_area.animate({
					scrollTop: height
				}, 300);
			}
			$(this).removeClass('last');
		});
	},

	render_next_search: function(keywords) {
		this.current += 1;
		if(this.current < this.search_objects.length){
			// More searches to go
			this.search_objects[this.current].build_results_object(this, keywords);
		} else {
			// If there's only one link in sidebar, there's no summary (show its full list)
			if(this.sidebar.find('.list-link').length === 1) {
				this.bind_events();
				this.sidebar.find('.list-link').trigger('click');
				this.results_area.find('.all-results-link').hide();

			} else if (this.sidebar.find('.list-link').length === 0) {
				this.results_area.html('<p class="results-status text-muted" style="text-align: center;">'+
					'No results found for: '+ "'"+ keywords +"'" +'</p>');
			} else {
				var list_types = this.get_all_list_types();
				if(list_types.indexOf(this.current_type) >= 0) {
					this.bind_events();
					this.sidebar.find('*[data-category="'+ this.current_type +'"]').trigger('click');
				} else {
					this.show_summary();
				}
			}
		}
	},

	get_all_list_types: function() {
		var types = [];
		this.sidebar.find('.list-link').each(function() {
			types.push($(this).attr('data-category'));
		});
		return types;
	}

});

frappe.search.GlobalSearch = Class.extend({
	init: function() {
		this.search_type = 'Global Search';
	},

	setup: function() {
		this.types = [];
		this.sections = [];
		this.lists = {};
		this.more_length = 15;
		this.start = {};
		this.section_length = 3;

		this.set_types();
	},

	set_types: function() {
		var me = this;
		this.current_type = 0;
		frappe.call({
			method: "frappe.utils.global_search.get_search_doctypes",
			args: { text: me.keywords },
			callback: function(r) {
				if(r.message) {
					r.message.forEach(function(d) {
						me.types.push(d.doctype);
						me.start[d.doctype] = 0;
					});
					me.sidelist = me.make_sidelist();
					me.get_result_set(me.types[me.current_type]);
				} else {
					me.render_object.render_next_search(me.keywords);
				}
			}
		});
	},

	make_sidelist: function() {
		var me = this;
		var sidelist = $('<ul class="list-unstyled sidebar-menu nav-list"></ul>');
		sidelist.append('<li class="h6">'+ me.search_type +'</li>');
		this.types.forEach(function(type) {
			sidelist.append(me.make_sidelist_item(type));
		});
		sidelist.append('<li class="divider"></li>');
		return sidelist;
	},

	make_sidelist_item: function(type) {
		var sidelist_item = '<li class="list-link" data-search="{0}"' +
			'data-category="{1}"><a>{1}</a></li>';
		return $(__(sidelist_item, [this.search_type, type]));
	},

	get_result_set: function(doctype){
		var me = this;
		var more = true;
		frappe.call({
			method: "frappe.utils.global_search.search_in_doctype",
			args: {
				doctype: doctype,
				text: me.keywords,
				start: me.start[doctype],
				limit: me.more_length,
			},
			callback: function(r) {
				if(r.message) {
					me.start[doctype] += me.more_length;
					if(r.message.length < me.more_length) {
						more = false;
					}
					me.make_type_results(doctype, r.message, more);
				}
			}
		});
	},

	make_type_results: function(type, results, more) {
		var last_type = (type == this.types.slice(-1));
		this.sections.push(this.make_section(type, results));
		this.lists[type] = this.make_full_list(type, results, more);
		if(!last_type) {
			this.current_type += 1;
			this.get_result_set(this.types[this.current_type]);
		} else {
			this.render_results();
		}
	},

	build_results_object: function(r, keywords) {
		this.render_object = r;
		this.keywords = keywords;
		this.setup();
	},

	render_results: function() {
		var me = this;
		if(this.sections.length > 0) {
			this.render_object.render_results({
				sidelist: me.sidelist,
				sections: me.sections,
				lists: me.lists
			}, me.keywords);
		}
	},

	make_result_item: function(type, result) {
		var link_html = '<div class="result '+ type +'-result">' +
			'<a href="{0}" class="module-section-link small">{1}</a>' +
			'<p class="small">{2}</p>' +
			'</div>';
		var formatted_result = this.format_result(result);
		return $(__(link_html, formatted_result));
	},

	format_result: function(result) {
		var route = '#Form/' + result.doctype + '/' + result.name;
		return [route, this.bold_keywords(result.name),
			this.get_finds(result.content, this.keywords)]
	},

	get_finds: function(searchables, keywords) {
		var me = this;
		parts = searchables.split("|||");
		content = "";
		parts.forEach(function(part) {
			if(part.toLowerCase().indexOf(keywords) !== -1) {
				var colon_index = part.indexOf(':');
				part = '<span class="field-name text-muted">' +
					part.slice(0, colon_index + 1) + '</span>' +
					me.bold_keywords(part.slice(colon_index + 1), keywords);
				content += part + ', ';
			}
		});
		return content.slice(0, -2);
	},

	bold_keywords: function(str, keywords) {
		var regEx = new RegExp("("+ keywords +")", "ig");
		return str.replace(regEx, '<b>$1</b>');
	},

	make_section: function(type, results) {
		var me = this;
		var results_section = $('<div class="row module-section '+type+'-section">'+
			'<div class="col-sm-12 module-section-column">' +
			'<div class="h4 section-head">'+type+'</div>' +
			'<div class="section-body"></div>'+
			'</div></div>');
		var results_col = results_section.find('.module-section-column');
		results.slice(0, this.section_length).forEach(function(result) {
			results_col.append(me.make_result_item(type, result));
		});
		if(results.length > this.section_length) {
			results_col.append('<a class="small section-more" data-category="'
				+ type + '">More...</a>');
		}
		return results_section;
	},

	make_full_list: function(type, results, more) {
		var me = this;
		var results_list = $(' <div class="module-body"><div class="row module-section '+
			type+'-section">'+'<div class="col-sm-12 module-section-column">' +
			'<div class="back-link"><a class="all-results-link small"> All Results</a></div>' +
			'<div class="h4 section-head">'+type+'</div>' +
			'<div class="section-body"></div>'+
			'</div></div></div>');
		var results_col = results_list.find('.module-section-column');
		results.forEach(function(result) {
			results_col.append(me.make_result_item(type, result));
		});
		if(more) {
			results_col.append('<a class="small list-more" data-search="'+ this.search_type +'" data-category="'
				+ type + '">More...</a>');
		}
		return results_list;
	},

	get_more_results: function(doctype) {
		var me = this;
		var more = true;
		frappe.call({
			method: "frappe.utils.global_search.search_in_doctype",
			args: {
				doctype: doctype,
				text: me.keywords,
				start: me.start[doctype],
				limit: me.more_length,
			},
			callback: function(r) {
				if(r.message) {
					me.start[doctype] += me.more_length;
					me.make_more_list(doctype, r.message, more);
				}
			}
		});
	},

	make_more_list: function(type, results, more) {
		var me = this;
		if(results.length < this.more_length) { more = false; }

		var more_results = $('<div class="more-results last"></div>');
		results.forEach(function(result) {
			more_results.append(me.make_result_item(type, result));
		});
		this.render_object.add_more_results([more_results, more]);
	},

	get_awesome_bar_options: function(keywords, ref) {

		var me = this;
		var doctypes = [];
		var current = 0;
		var results = [];

		var get_doctypes = function(){
			var me = this;
			frappe.call({
				method: "frappe.utils.global_search.get_search_doctypes",
				args: { text: keywords },
				callback: function(r) {
					if(r.message) {
						r.message.forEach(function(d) {
							doctypes.push(d.doctype);
						});
						get_results();
					}
				}
			});
		};

		var get_results = function() {
			frappe.call({
				method: "frappe.utils.global_search.search_in_doctype",
				args: {
					doctype: doctypes[current],
					text: keywords,
					start: 0,
					limit: 4,
				},
				callback: function(r) {
					if(r.message) {
						r.message.forEach(function(d) {
							results.push(make_option(d));
						});
						current += 1;
						if(current < doctypes.length) {
							get_results();
						} else {
							ref.set_global_results(results);
						}
					}
				}
			});
		};

		var make_option = function(data) {
			console.log("GS search", me.get_finds(data.content, keywords).slice(0,86) + '...');
			return {
				label: __("{0}: {1}", [__(data.doctype).bold(), data.name]),
				value: __("{0}: {1}", [__(data.doctype), data.name]),
				route: ["Form", data.doctype, data.name],
				match: data.doctype,
				index: 5,
				description: me.get_finds(data.content, keywords).slice(0,86) + '...'
			}
		};

		get_doctypes();

	}

});

frappe.search.NavSearch = frappe.search.GlobalSearch.extend({
	init: function() {
		this.search_type = 'Navigation';
	},

	set_types: function() {
		var me = this;
		this.section_length = 4;
		this.awesome_bar = new frappe.search.AwesomeBar();
		this.nav_results = {
			"Search in ...": me.awesome_bar.make_search_in_list(me.keywords),
			"Lists": me.awesome_bar.get_doctypes(me.keywords),
			"Reports": me.awesome_bar.get_reports(me.keywords),
			"Pages": me.awesome_bar.get_pages(me.keywords),
			"Modules": me.awesome_bar.get_modules(me.keywords)
		}
		var types = ["Search in ...", "Lists", "Reports", "Pages", "Modules"];
		types.forEach(function(type) {
			if(me.nav_results[type].length > 0) {
				me.types.push(type);
				me.start[type] = 0;
			}
		});
		if(this.types.length > 0) {
			this.sidelist = this.make_sidelist();
			this.get_results();
		} else {
			this.render_object.render_next_search(me.keywords);
		}
	},

	get_results: function() {
		var me = this;
		this.types.forEach(function(type) {
			me.get_result_set(type);
		});
	},

	get_result_set: function(type) {
		var last_type = (type == this.types.slice(-1));
		var results = this.nav_results[type].slice(this.start[type], this.more_length);
		this.start[type] += this.more_length;
		var more = true;
		if(results.slice(-1)[0] === this.nav_results[type].slice(-1)[0]) {
			more = false;
		}
		this.make_type_results(type, results, more);
		if(last_type) {
			this.render_results();
		}
	},

	make_type_results: function(type, results, more) {
		this.sections.push(this.make_section(type, results));
		this.lists[type] = this.make_full_list(type, results, more);
	},

	get_more_results: function(type) {
		var results = this.nav_results[type].slice(this.start[type],
			this.start[type]+this.more_length);
		this.start[type] += this.more_length;
		var more = true;
		if(results.slice(-1)[0] === this.nav_results[type].slice(-1)[0]) {
			more = false;
		}
		this.make_more_list(type, results, more)
	},

	make_result_item: function(type, result) {
		var link_html = '<div class="result '+ type +'-result single-link">' +
			'<a href="{0}" class="module-section-link small">{1}</a>' +
			'<p class="small"></p></div>';
		if(!result.onclick) {
			var link = $(__(link_html, ['#', result.label]));
			link.on('click', function() {
				if(result.route_options) {
					frappe.route_options = result.route_options;
				}
				frappe.set_route(result.route);
				return false;
			});
			return link;
		} else {
			var link = $(__(link_html, ['#', result.label]));
			link.on('click', function() {
				frappe.new_doc(result.match, true);
				// result.onclick(result.match, true);
			});
			return link;
		}
	},

	make_dual_sections: function() {
		this.dual_sections = [];
		var section_html = '<div class="row module-section dual-section"></div>';
		for(var i = 0; i < this.sections.length; i++) {
			var results_section = $(section_html);
			for(var j = 0; j < 2 && i < this.sections.length; j++, i++){
				results_section.append(this.sections[i]);
			}
			i--;
			this.dual_sections.push(results_section);
		}
	},

	render_results: function() {
		var me = this;
		this.make_dual_sections();
		if(this.dual_sections.length > 0) {
			this.render_object.render_results({
				sidelist: me.sidelist,
				sections: me.dual_sections,
				lists: me.lists
			}, me.keywords);
		}
	},

	make_section: function(type, results) {
		var me = this;
		var results_column = $('<div class="col-sm-6 module-section-column">' +
			'<div class="h4 section-head">'+type+'</div>' +
			'<div class="section-body"></div>'+
			'</div>');
		results.slice(0, this.section_length).forEach(function(result) {
			results_column.append(me.make_result_item(type, result));
		});
		if(results.length > this.section_length) {
			results_column.append('<a class="small section-more" data-category="'
				+ type + '">More...</a>');
		}
		return results_column;
	}
});

frappe.search.HelpSearch = frappe.search.GlobalSearch.extend({
	init: function() {
		this.search_type = 'Help';
	},

	set_types: function() {
		this.types = [this.search_type];
		this.sidelist = this.make_sidelist();
		this.get_result_set(this.types[0]);
	},

	make_sidelist: function() {
		var sidelist = $('<ul class="list-unstyled sidebar-menu nav-list"></ul>');
		var sidelist_item = '<li class="h6 list-link" data-search="'+ this.search_type + '"' +
			'data-category="'+ this.search_type + '"><a style="font-size: 11px;">'+
			this.search_type +'</a></li>';
		sidelist.append(sidelist_item);
		sidelist.append('<li class="divider"></li>');
		return sidelist;
	},

	get_result_set: function(type) {
		var me = this;
		frappe.call({
			method: "frappe.utils.help.get_help",
			args: {
				text: me.keywords
			},
			callback: function(r) {
				if(r.message) {
					// Help search doesn't have a more button for full list
					me.make_type_results(type, r.message, false);
					me.render_results();
				} else {
					me.render_object.render_next_search(me.keywords);
				}
			}
		});
	},

	make_type_results: function(type, results, more) {
		this.sections.push(this.make_section(type, results));
		this.lists[type] = this.make_full_list(type, results, more);
	},

	make_result_item: function(type, result) {
		var me = this;
		var link_html = '<div class="result '+ type +'-result">' +
			'<a href="#" data-path="{0}" class="module-section-link small">{1}</a>' +
			'<p class="small">{2}</p>' +
			'</div>';
		var link = $(__(link_html, [result[2], result[0], result[1]]));
		link.find('a').on('click', frappe.help.show_results);
		return link;
	},

});
