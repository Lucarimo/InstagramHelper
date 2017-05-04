/* jshint esnext: true */
/* globals chrome */

$(function () {

	"use strict";

	var myData = [];
	var htmlElements = {
		statusDiv: document.getElementById('status'),
		follows: $('#follows'),
		followed_by: $('#followed_by')
	};

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request.action == "get_insta_users") {

			var promise = instaDefOptions.you === request.userName ? userInfo.getUserProfile(request.viewerUserName) : request.userName;
			Promise.all([promise]).then(values => {
				if (typeof values[0] === "object") {
					request.userName = request.viewerUserName;
					request.user_is_private = values[0].is_private;
					request.follows_count = values[0].follows_count;
					request.followed_by_count = values[0].followed_by_count;
					request.userId = values[0].id;
					request.user_followed_by_viewer = false;
				}
				startFetching(request);
			});
		}
	});

	function startFetching(request) {

		var fetchSettings = {
			request: null,
			userName: request.userName,
			pageSize: request.pageSize,
			delay: request.delay,
			csrfToken: request.csrfToken,
			userId: request.userId,
			relType: "All" === request.relType ? request.follows_count > request.followed_by_count ? "follows" : "followed_by" : request.relType,
			callBoth: "All" === request.relType,
			checkDuplicates: myData.length > 0, //probably we are starting with already opened page , now it is obsolete, and actually should be False
			follows_count: request.follows_count,
			followed_by_count: request.followed_by_count,
			follows_processed: 0,
			followed_by_processed: 0,
			startTime: new Date(),
			timerInterval: startTimer(document.querySelector('#timer'), new Date()),
			receivedResponses: 0
		};
		prepareHtmlElements(fetchSettings);
		fetchInstaUsers(fetchSettings);
	}

	function startTimer(timer, startTime) {

		return setInterval(function () {
			var ms = parseInt(new Date() - startTime);
			var x = ms / 1000;
			var seconds = parseInt(x % 60, 10);
			x /= 60;
			var minutes = parseInt(x % 60, 10);
			x /= 60;
			var hours = parseInt(x % 24, 10);
			timer.textContent = `${hours}h:${'00'.substring(0, 2 - ("" + minutes).length)  + minutes}m:${'00'.substring(0, 2 - ("" + seconds).length) + seconds}s`;
		}, 1000);
	}

	function updateStatusDiv(message) {
		htmlElements.statusDiv.textContent = message;
	}

	function showJQGrid(obj) {
		$("#jqGrid").jqGrid({
			pager: "#jqGridPager",
			datatype: "local",
			data: myData,
			rowNum: 1000,
			autowidth: true,
			//shrinkToFit: true,
			height: "100%",
			rownumbers: true,
			colModel: [{
					label: 'User',
					name: 'profile_pic_url_hd',
					width: '320',
					align: 'center',
					sortable: false,
					formatter: function (cellvalue, model, row) {
						return `<a href='https://www.instagram.com/${row.username}' target='_blank'><img src='${cellvalue}' alt='' /></a>`;
					},
					search: false
				}, {
					label: 'Info',
					name: 'id',
					//width: '200',
					sortable: false,
					formatter: function (cellvalue, model, row) {
						var ret = `id:${row.id}<br/>username:<strong>${row.username}</strong><br/>`;
						ret += row.full_name ? `full name:<strong>${row.full_name}</strong><br/>` : "";
						ret += row.connected_fb_page ? `FB:<a href='${row.connected_fb_page}' target='_blank'>${row.connected_fb_page}</a><br/>` : "";
						ret += row.external_url ? `url:<a href='${row.external_url}' target='_blank'>${row.external_url}</a>` : "";
						return ret;
					},
					cellattr: function (rowId, tv, rawObject, cm, rdata) {
						return 'style="white-space: normal;"';
					},
					search: false
				}, {
					label: 'Bio',
					name: 'biography',
					sortable: false,
					formatter: function (cellvalue, model, row) {
					//	return cellvalue ? `<p>${cellvalue}</p>` : "";
						return cellvalue ? cellvalue : "";
					},
					cellattr: function (rowId, tv, rawObject, cm, rdata) {
						return 'style="white-space: normal;"';
					},
					search: false
				}, {
					label: 'Follows <br/>you',
					name: 'follows_viewer',
					width: '80',
					formatter: 'checkbox',
					align: 'center',
					stype: 'select',
					searchoptions: {
						sopt: ["eq"],
						value: ":Any;true:Yes;false:No"
					},
					cellattr: function (rowId, tv, rawObject, cm, rdata) {
						return 'style="background-color: #fbf9ee;" title="Follows you"';
					},
					search: true
				}, {
					label: 'Followed <br>by you',
					name: 'followed_by_viewer',
					width: '80',
					formatter: 'checkbox',
					align: 'center',
					stype: 'select',
					searchoptions: {
						sopt: ["eq"],
						value: ":Any;true:Yes;false:No"
					},
					cellattr: function (rowId, tv, rawObject, cm, rdata) {
						return 'style="background-color: #fbf9ee;" title="Followed by you"';
					},
					search: true
				}, {
					label: 'Follows <br/>user',
					name: 'user_followed_by', //relationship: followed_by - the list of the user's followers
					width: '80',
					formatter: 'checkbox',
					align: 'center',
					stype: 'select',
					searchoptions: {
						sopt: ["eq"],
						value: ":Any;true:Yes;false:No"
					},
					cellattr: function () {
						return `title="Follows ${obj.userName}"`;
					},
					search: true
				}, {
					label: 'Followed <br/>by user',
					name: 'user_follows', //relationship: follows - from the list of the followed person by user
					width: '80',
					formatter: 'checkbox',
					align: 'center',
					stype: 'select',
					searchoptions: {
						sopt: ["eq"],
						value: ":Any;true:Yes;false:No"
					},
					cellattr: function () {
						return `title="Followed by ${obj.userName}"`;
					},
					search: true
				}, {
					label: 'Private',
					name: 'is_private',
					width: '80',
					formatter: 'checkbox',
					align: 'center',
					stype: 'select',
					searchoptions: {
						sopt: ["eq"],
						value: ":Any;true:Yes;false:No"
					},
					cellattr: function () {
						return 'title="Is private"';
					},
					search: true
				}, {
					label: 'Followers',
					name: 'followed_by_count',
					width: '70',
					align: 'center',
					sorttype: 'number',
					search: true,
					searchoptions: {
						sopt: ["ge", "le", "eq"]
					},
					cellattr: function () {
						return 'title="Followers"';
					}
				}, {
					label: 'Following',
					name: 'follows_count',
					width: '70',
					align: 'center',
					sorttype: 'number',
					search: true,
					searchoptions: {
						sopt: ["ge", "le", "eq"]
					},
					cellattr: function () {
						return 'title="Following"';
					}
				}, {
					label: 'Posts',
					name: 'media_count',
					width: '70',
					align: 'center',
					sorttype: 'number',
					search: true,
					searchoptions: {
						sopt: ["ge", "le", "eq"]
					},
					cellattr: function () {
						return 'title="Posts"';
					}
				}
			],
			viewrecords: true, // show the current page, data rang and total records on the toolbar
			loadonce: true,
			caption: "Users of " + obj.userName,
		}).jqGrid('filterToolbar', {
			searchOperators: true
		}).jqGrid('navGrid', "#jqGridPager", {
			search: true,
			add: false,
			edit: false,
			del: false,
			refresh: true
		}, {}, {}, {}, {
			multipleSearch: true,
			closeAfterSearch: true,
			closeOnEscape: true,
			searchOnEnter: true,
			showQuery: true
		}, // pSearch (works with these options)
		{}).jqGrid('setGridWidth', $('#jqGrid').width() - 20); //TODO: find why autowidth doesn't work

	}

	function showExportDiv(obj) {

		$("#exportDiv").show();

		$("#export_XLSX").on("click", function () {
			$("#jqGrid").jqGrid("exportToExcel", {
				includeLabels: true,
				includeGroupHeader: false,
				includeFooter: false,
				fileName: `user_${obj.userName}_${exportUtils.formatDate(new Date())}.xlsx`,
				replaceStr: exportUtils.replaceStr
			});
		});
		
	}

	function prepareHtmlElements(obj) {

		//statusDiv = document.getElementById('status');

		if (obj.callBoth || ("followed_by" === obj.relType)) {
			document.getElementById("followed_by_title").textContent = `${obj.userName} is followed by ${obj.followed_by_count} users`;
			document.getElementById("followed_by_title").style.display = "block";
			htmlElements.followed_by.show().asProgress({
				namespace: 'progress',
				min: 0,
				max: obj.followed_by_count,
				goal: obj.followed_by_count,
				labelCallback(n) {
					const percentage = this.getPercentage(n);
					return `Followed by:${obj.followed_by_processed}/${obj.followed_by_count}/${percentage}%`;
				}
			});
		}
		if (obj.callBoth || ("follows" === obj.relType)) {
			document.getElementById("follows_title").textContent = `${obj.userName} follows ${obj.follows_count} users`;
			document.getElementById("follows_title").style.display = "block";
			htmlElements.follows.show().asProgress({
				namespace: 'progress',
				min: 0,
				max: obj.follows_count,
				goal: obj.follows_count,
				labelCallback(n) {
					const percentage = this.getPercentage(n);
					return `Follows:${obj.follows_processed}/${obj.follows_count}/${percentage}%`;
				}
			});
		}
	}

	function updateProgressBar(obj, count) {
		var newValue = 0 + obj[obj.relType + "_processed"] + count;
		htmlElements[obj.relType].asProgress("go", newValue);
		obj[obj.relType + "_processed"] = newValue;
	}

	function stopProgressBar(obj) {
		htmlElements[obj.relType].asProgress("finish").asProgress("stop");
	}

	function generationCompleted(obj) {
		clearInterval(obj.timerInterval);
		var timer = document.querySelector('#timer');
		var diffFollowed = "", diffFollows = "";
		//console.log(obj);
		if (obj.followed_by_count != obj.followed_by_processed) {
			diffFollowed = `(actually returned ${obj.followed_by_processed})`;
			
		}
		if (obj.follows_count != obj.follows_processed) {
			diffFollows = `(actually returned ${obj.follows_processed})`;
		}

		updateStatusDiv(`Completed, spent time - ${timer.textContent}, created list length - ${myData.length} (follows - ${obj.follows_count}${diffFollows}, followed by - ${obj.followed_by_count}${diffFollowed})`);
		setTimeout(function () {
			document.getElementById('tempUiElements').remove();
			//htmlElements.followed_by.remove();
			//htmlElements.follows.remove();
			//timer.parentNode.removeChild(timer);
		}, 3000);
		showJQGrid(obj);
		showExportDiv(obj);
	}

	function fetchInstaUsers(obj) {

		if (!obj.request) {
			obj.request = $.param({
					q: `ig_user(${obj.userId}) {${obj.relType}.first(${obj.pageSize}) {count, page_info {end_cursor, has_next_page},
			nodes {id, is_verified, followed_by_viewer, requested_by_viewer, full_name, profile_pic_url_hd, username, connected_fb_page, 
			external_url, biography, follows_viewer, is_private, follows { count }, followed_by { count }, media { count }}}}`, 
					ref: "relationships::follow_list"
				});
		}

		$.ajax({
			url: "https://www.instagram.com/query/",
			crossDomain: true,
			headers: {
				"X-Instagram-AJAX": '1',
				"X-CSRFToken": obj.csrfToken,
				//"X-Requested-With": XMLHttpRequest,
				"eferer": "https://www.instagram.com/" + obj.userName + "/"
			},
			method: 'POST',
			data: obj.request,
			success: function (data, textStatus, xhr) {
				obj.receivedResponses += 1;
				if (429 == xhr.status) {
					console.log("HTTP429 error.", new Date());
					updateStatusDiv(messages.getMessage("HTTP429", +instaDefOptions.retryInterval / 60000));
					timeout.setTimeout(3000)
						.then(function(){
							return countdown.doCountdown("status", (new Date()).getTime() + +instaDefOptions.retryInterval)
						})
						.then(function(){
							console.log("Continue execution after HTTP429 error.", new Date());
							fetchInstaUsers(obj);
						});
					//setTimeout(function () {
					//	console.log("Continue execution after HTTP429 error.", new Date());
					//	fetchInstaUsers(obj);
					//}, instaDefOptions.retryInterval); //TODO: Test and make configurable
					//return;
				}
				//if (typeof data[obj.relType].nodes === "undefined") {
				//	alert("the users are not returned, seems you are not logged in or trying to gather the list of users of shared account");
				//  return;
				//}
				updateStatusDiv("received users - " + data[obj.relType].nodes.length + " (" + obj.relType + ")");
				//otherwise assume return code is 200?
				for (let i = 0; i < data[obj.relType].nodes.length; i++) {
					var found = false;
					if (obj.checkDuplicates) { //only when the second run happens (or we started with already opened result page)
						for (let j = 0; j < myData.length; j++) {
							if (data[obj.relType].nodes[i].username === myData[j].username) {
								found = true;
								//console.log(`username ${myData[j].username} is found at ${i}`);
								myData[j]["user_" + obj.relType] = true;
								break;
							}
						}
					}
					if (!(found)) {
						data[obj.relType].nodes[i].followed_by_count = data[obj.relType].nodes[i].followed_by.count;
						data[obj.relType].nodes[i].follows_count = data[obj.relType].nodes[i].follows.count;
						data[obj.relType].nodes[i].media_count = data[obj.relType].nodes[i].media.count;
						data[obj.relType].nodes[i].user_follows = false; //explicitly set the value for correct search
						data[obj.relType].nodes[i].user_followed_by = false; //explicitly set the value for correct search
						data[obj.relType].nodes[i]["user_" + obj.relType] = true;
						delete data[obj.relType].nodes[i].followed_by;
						delete data[obj.relType].nodes[i].follows;
						delete data[obj.relType].nodes[i].media;
						myData.push(data[obj.relType].nodes[i]);
					}
				}
				updateProgressBar(obj, data[obj.relType].nodes.length);

				if (data[obj.relType].page_info.has_next_page) {
					obj.request = $.param({
							q: `ig_user(${obj.userId}) {${obj.relType}.after(${data[obj.relType].page_info.end_cursor}, ${obj.pageSize}) {count, page_info {end_cursor, has_next_page},
					nodes {id, is_verified, followed_by_viewer, requested_by_viewer, full_name, profile_pic_url_hd, username, connected_fb_page, 
					external_url, biography, follows_viewer, is_private, follows { count }, followed_by { count }, media { count }}}}`, 
							ref: "relationships::follow_list"
						});
					setTimeout(function () {
						fetchInstaUsers(obj);
					}, calculateTimeOut(obj));
				} else {
					stopProgressBar(obj);
					if (obj.callBoth) {
						obj.request = null;
						obj.relType = obj.relType === "follows" ? "followed_by" : "follows";
						obj.callBoth = false;
						obj.checkDuplicates = true;
						setTimeout(function () {
							fetchInstaUsers(obj);
						}, calculateTimeOut(obj));
					} else {
						//we are done
						generationCompleted(obj);
					}
				}
			},
			error: function (jqXHR, exception) {
				console.log("error ajax");
				console.log(arguments); //jqXHR.status
				if (jqXHR.status === 0) {
					setTimeout(function () {
						fetchInstaUsers(obj);
					}, instaDefOptions.retryInterval); //TODO: Test and make configurable
					alert(messages.getMessage("NOTCONNECTED", +instaDefOptions.retryInterval / 60000));
				} else if (jqXHR.status === 429) {
					console.log("HTTP429 error.", new Date());
					updateStatusDiv(messages.getMessage("HTTP429", +instaDefOptions.retryInterval / 60000));
					timeout.setTimeout(3000)
						.then(function(){
							return countdown.doCountdown("status", (new Date()).getTime() + +instaDefOptions.retryInterval)
						})
						.then(function(){
							console.log("Continue execution after HTTP429 error.", new Date());
							fetchInstaUsers(obj);
						});
					
					//setTimeout(function () {
					//	console.log("Continue execution after HTTP429 error.", new Date());
					//	updateStatusDiv(messages.getMessage("HTTP429CONT"));
					//	fetchInstaUsers(obj);
					//}, instaDefOptions.retryInterval);
					//alert(messages.getMessage("HTTP429", +instaDefOptions.retryInterval / 60000));
				} else if (jqXHR.status == 404) {
					alert(messages.getMessage("HTTP404"));
				} else if (jqXHR.status == 500) {
					alert(messages.getMessage("HTTP500"));
				} else if (exception === 'parsererror') {
					alert(messages.getMessage("JSONPARSEERROR"));
				} else if (exception === 'timeout') {
					alert(messages.getMessage("TIMEOUT"));
				} else if (exception === 'abort') {
					alert(messages.getMessage("AJAXABORT"));
				} else {
					alert(messages.getMessage("UNCAUGHT", jqXHR.responseText));
				}
			}
		});

	}

	function calculateTimeOut(obj) {
		if (instaDefOptions.noDelayForInit && (obj.receivedResponses < instaDefOptions.requestsToSkipDelay)) {
			return 0;
		}
		return obj.delay;
	}

});

window.onload = function () {
	_gaq.push(['_trackPageview']);
};
