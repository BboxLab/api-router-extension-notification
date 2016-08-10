var boolError;
var api = {
	operation: function (type, url, callback){
	    var xhr= new XMLHttpRequest();
	    xhr.open(type, getOptions().address + '/api/v1/' + url, true);
	    xhr.timeout=2000;
	    xhr.onreadystatechange=function() {
	        if (xhr.readyState==4) {
	        	if(xhr.status === 200 && callback) {
	        		if(!boolError) {
		        		chrome.browserAction.setIcon({
		                    path: '/logo-bbox-48.png'
		                });
	        		}
	                callback(JSON.parse(xhr.responseText));
	        	}
	        	else if(callback) {
	        		chrome.browserAction.setIcon({
	                    path: '/logo-bbox-error.png'
	                });
	        		callback({'error': xhr.status})
	        	}
	        }
	    };
	    xhr.send();
	},
	summary: function(callback) {
		api.operation('GET', 'summary', callback);
	},
    device: {
        get: function(callback) {
            return api.operation('GET', 'device', callback);
        }
    },
    network_devices: {
        get: function(callback) {
            return api.operation('GET', 'hosts', callback);
        },
	    me: function(callback) {
	        return api.operation('GET', 'hosts/me', callback);
	    }
    },
    diags : function(callback) {
        return api.operation('GET', 'wan/diags', callback);
    }
};

var tabId = 1;
chrome.tabs.onActivated.addListener(function(info) {
	tabId = info.tabId;
})
var createNotif = function(txt, type) {
	chrome.tabs.getSelected(null,function(tab) {
		type = type || "";
		var options = getOptions();
		var address = options.address;
	    if(tab.url.indexOf('http://192.168.1.254') === -1 &&
	    		tab.url.indexOf('http://bbox.lan') === -1 &&
	    		tab.url.indexOf('http://gestionbbox.lan') === -1 &&
	    		tab.url.indexOf('http://' + address) === -1) {
	    	var code = '.alertify-log-mydevice {background: ' + options.mydeviceBG + ';color: ' + options.mydeviceColor + ';}'
	    	code += '.alertify-log-otherdevice {background: ' + options.otherdeviceBG + ';color: ' + options.otherdeviceColor + ';}'
	    	
	    	chrome.tabs.insertCSS(null, {code: code},function() {
				if(chrome.runtime.lastError) {
					chrome.tabs.create({
			            url: chrome.extension.getURL('/window/window.html#msg/' + encodeURI(txt)),
			            active: true
			        }, function(tab) {
//			        	chrome.browserAction.setBadgeText({'text': '2'});
			        	chrome.windows.getCurrent(function(w) {
			        		chrome.windows.create({
				                tabId: tab.id,
				                type: 'popup',
				                focused: true,
				                height: 100,
				                width: 300,
				                top: Math.max(w.height - 100, 100)
				                // incognito, top, left, ...
				            });
				        });
			    	});
				}
				else {
					chrome.tabs.executeScript({code: 'alertify.log("' + txt + '", "' + type + '", 10000);'});
				}
			});
		}
	});
}

var oldUsb;
var updateUsb = function(usb) {
	if(!oldUsb) {
		oldUsb = usb;
	}
	if(JSON.stringify(usb) !== JSON.stringify(oldUsb)) {
		var tabOldUsb = {};
		var l1 = oldUsb.length;
		for(var i = 0; i < l1; i++) {
			tabOldUsb[oldUsb[i].label] = oldUsb[i].state;
		}
		var tabUsb = {};
		var l2 = usb.length;
		for(var i = 0; i < l2; i++) {
			tabUsb[usb[i].label] = usb[i].state;
		}
		for(var i in tabOldUsb) {
            if (tabOldUsb.hasOwnProperty(i)) {
				if(!tabUsb[i]) {
					createNotif(Bbox.Messages.page_common_usb + ' ' + i + ' ' + Bbox.Messages.page_common_was + ' ' + Bbox.Messages.page_common_disap + '.');
				}
				else if(tabUsb[i] !== tabOldUsb[i]){
					createNotif('Le périphérique USB ' + i + ' ' + Bbox.Messages.page_common_was + ' ' + (tabUsb[i] === 'ConnectedMounted' ? Bbox.Messages.page_common_mount : Bbox.Messages.page_common_umount) + '.');
				}
            }
		}
		for(var i in tabUsb) {
            if (tabUsb.hasOwnProperty(i)) {
				if(!tabOldUsb[i]) {
					createNotif('Le périphérique USB ' + i + ' ' + Bbox.Messages.page_common_was + ' ' + Bbox.Messages.page_common_insert + '.');
				}
            }
		}
		oldUsb = usb;
	}
};

var oldHost;
var updateHost = function(host) {
	if(!oldHost) {
		oldHost = host;
	}
	if(JSON.stringify(host) !== JSON.stringify(oldHost)) {
		var tabOldHost = {};
		var l1 = oldHost.length;
		for(var i = 0; i < l1; i++) {
			tabOldHost[oldHost[i].ipaddress] = oldHost[i].hostname;
		}
		var tabHost = {};
		var l2 = host.length;
		for(var i = 0; i < l2; i++) {
			tabHost[host[i].ipaddress] = host[i].hostname;
		}
		for(var i in tabOldHost) {
            if (tabOldHost.hasOwnProperty(i)) {
				if(tabHost[i] === undefined) {
					createNotif(Bbox.Messages.page_common_device + ' ' + (tabOldHost[i] ? tabOldHost[i] : i) + ' ' + Bbox.Messages.page_common_disconnect + '.');
				}
            }
		}
		var newDevice = [];
		for(var i in tabHost) {
            if (tabHost.hasOwnProperty(i)) {
				if(tabOldHost[i] === undefined) {
					newDevice.push({ipaddress: i, hostname: tabHost[i]});
				}
            }
		}
		if(newDevice.length > 0) {
			api.network_devices.get(function(response) {
				var list = response[0].hosts.list;
				var l = list.length;
				for(var i = 0; i < l; i++) {
					var l2 = newDevice.length;
					for(var j = 0; j < l2; j++) {
						if(list[i].hostname === newDevice[j].hostname && 
								list[i].ipaddress === newDevice[j].ipaddress) {
							var msg = Bbox.Messages.page_common_device;
							 msg += (newDevice[j].hostname ? newDevice[j].hostname : newDevice[j].ipaddress) + ' ';
							 msg += Bbox.Messages.page_common_connect;
							 if(list[i].link.toLowerCase().indexOf('wifi') > -1) {
								 msg += ' en ' + list[i].link;
						            if (list[i].wireless.rssi0 <= -75) {
						                msg += ' avec une qualité faible (RSSI : ' + (list[i].wireless.rssi0) + ' dbm).';
						                msg += 'Vous pouvez vous connecter en ';
						                if(list[i].link.indexOf('5') > -1) {
						                	msg += '2.4 GHz afin de bénéficier d\'une qualité plus élevée.';
						                }
						                else {
						                	msg += '5 GHz afin de bénéficier d\'une qualité plus élevée.';
						                }
						            } 
						            else if (list[i].wireless.rssi0 <= -60) {
						                msg += ' avec une qualité moyenne (RSSI : ' + (list[i].wireless.rssi0) + ' dbm).';
						            } 
						            else {
						                msg += ' avec une qualité élevée (RSSI : ' + (list[i].wireless.rssi0) + ' dbm).';
						            }
							 }
							 else {
								 msg += '.';
							 }
							 createNotif(msg);							
						}
					}
				}
			});
		}
		oldHost = host;
	}
};

var oldRing;
var updateRing = function(ring) {
	if(!oldRing) {
		oldRing = ring;
	}
	if(JSON.stringify(ring) !== JSON.stringify(oldRing)) {
		var length = ring.length;
		for(var i = 0; i < length; i++) {
			if(ring[i].ring_test.status !== oldRing[i].ring_test.status) {
				if(ring[i].ring_test.status !== '' && ring[i].ring_test.status.indexOf('Idle') === -1) {
					createNotif(Bbox.Messages.page_common_ringtest + ring[i].ring_test.id);
				}
				if(ring[i].echo_test.status !== '' && ring[i].echo_test.status.indexOf('Idle') === -1) {
					createNotif(Bbox.Messages.page_common_echotest + ring[i].echo_test.id);
				}
			}
		}
		oldRing = ring;
	}
};

var oldDisplay;
var updateDisplay = function(display) {
if(oldDisplay === undefined) {
    oldDisplay = display;
}
if(JSON.stringify(display) !== JSON.stringify(oldDisplay)) {
    
    if(display !== '.' && display !== '') {
    	createNotif(display.charAt(0).toUpperCase() + ' : ' + Bbox.Messages['display_' + display + '_title']);
    }
    oldDisplay = display;
}
};

var oldIptv2;
var objReceipt = {};
var updateIptv = function(iptv2, host) {
var first=0;
if(!oldIptv2 ) {
    first=1;
    oldIptv2 = iptv2;
}

if(first == 0 && JSON.stringify(oldIptv2) !== JSON.stringify(iptv2) ) {
    var length = iptv2.length;
    var bool2 = false;
    var boolNumber = true;
    for(var i = 0; i < length; i++) {
		if (oldIptv2.length == 0)
		    bool=true;
			if(iptv2[i].number > 0) {
				boolNumber = false;
			} 
			if(!bool && iptv2[i].ipaddress !== '' && (oldIptv2[i] && iptv2[i].number !== oldIptv2[i].number || iptv2[i].receipt === 0) && iptv2[i].number > 0 ) {
			    var l2 = oldIptv2.length;
			    var bool = true;
			    for(var j = 0; j < l2; j++) {
					if(iptv2[i].number === oldIptv2[j].number) {
					    bool = false;
					    break;
					}
			    }
			    if(iptv2[i].receipt === 0) {
			        if(objReceipt[iptv2[i].ipaddress + '_' + iptv2[i].number]) {
				    objReceipt[iptv2[i].ipaddress + '_' + iptv2[i].number]++;	        	
			        }
			        else {
			            objReceipt[iptv2[i].ipaddress + '_' + iptv2[i].number] = 1;
			        }
			        if(objReceipt[iptv2[i].ipaddress + '_' + iptv2[i].number] > 3) {
			            bool2 = true;
			        }
			    }
			    if(bool) {
					var hL = host.length;
					var text = 'BboxTV';
					for(var j = 0; j < hL; j++) {
					    if(host[j].ipaddress === iptv2[i].ipaddress && host[j].hostname !== '') {
						text = host[j].hostname;
				    }
				}
				createNotif(text + ' ' + Bbox.Messages.page_common_channel + '' + iptv2[i].number);
		    }
		}
    }
    oldIptv2 = iptv2;
}

};

var objTooltipShare = {
	'samba': null,
	'printer': null,
	'samba-printer': null
};
var oldMin;
var oldServices;
var updateServices = function(services) {
	if(!oldServices) {
		oldServices = services;
	}
	var tabServices = [
	           {tab: ['firewall'],
	        	   service: Bbox.Messages.page_common_firewall
	           },
	           {tab: ['dyndns'],
	        	   service: Bbox.Messages.page_common_dyndns
	           },
	           {tab: ['dhcp'],
	        	   service: Bbox.Messages.page_common_dhcp
	           },
	           {tab: ['nat'],
	        	   service: Bbox.Messages.page_common_nat
	           },
	           {tab: ['upnp', 'igd'],
	        	   service: Bbox.Messages.page_common_upnp
	           },
	           {tab: ['proxywol'],
	        	   service: Bbox.Messages.page_common_proxywol
	           },
	           {tab: ['remoteweb'],
	        	   service: Bbox.Messages.page_common_remoteweb
	           },
	           {tab: ['parentalcontrol'],
	        	   service: Bbox.Messages.page_common_parentalcontrol
	           },
	           {tab: ['wifischeduler'],
	        	   service: Bbox.Messages.page_common_wifischeduler
	           }
	           ];
	if(JSON.stringify(services) !== JSON.stringify(oldServices)) {
		var content = '';
		var length = tabServices.length;
		for(var i = 0; i < length; i++) {
			var path = services;
			var oldPath = oldServices;
			var length2 = tabServices[i].tab.length;
			for(var j = 0; j < length2; j++) {
				path = path[tabServices[i].tab[j]];
				oldPath = oldPath[tabServices[i].tab[j]];
			}
			if(path.enable !== oldPath.enable) {
				if(path.enable >= 1) {
					content += Bbox.Messages.page_common_service + ' ' + tabServices[i].service + ' ' + Bbox.Messages.page_common_active + '.<br>';
				}
				else {
					content += Bbox.Messages.page_common_service + ' ' + tabServices[i].service + ' ' + Bbox.Messages.page_common_disactive + '.<br>';
				}
			}
		}
		if(content !== '') {
			createNotif(content);
		}
		oldServices = services;
	}
};

var oldWireless;
var wirelessStatus;
var updateWireless = function(wireless, display) {
	if(!oldWireless) {
		oldWireless = wireless;
	}
	wirelessStatus = wireless.status;
	if(JSON.stringify(wireless) !== JSON.stringify(oldWireless)) {
		if(wireless.radio !== oldWireless.radio) {
			if(wireless.radio === 1) {
				createNotif(Bbox.Messages.page_common_wifienable);
			}
			else {
				createNotif(Bbox.Messages.page_common_wifidisable);
			}
		}
		if(wireless.wps.status !== oldWireless.wps.status) {
			if(location.pathname.indexOf('wps.html') !== -1) {
				getResult(wireless.wps.status);
			}
			if(wireless.wps.status === 'Progress') {
				createNotif(Bbox.Messages.page_common_wpspending);
			}
			else if(wireless.wps.status === 'Success') {
				createNotif(Bbox.Messages.page_common_wpssuccess);
			}
			else if(wireless.wps.status === 'Error') {
				createNotif(Bbox.Messages.pâge_common_wpserror);
			}
		    else if(wireless.wps.status === 'Cancelled') {
		    	createNotif(Bbox.Messages.page_common_wpscancel);
			}
		}
		oldWireless = wireless;
	}
};

var oldPrinter;
var updatePrinter = function(printer) {
	if(!oldPrinter) {
		oldPrinter = printer;
	}
	if(JSON.stringify(printer) !== JSON.stringify(oldPrinter)) {
		var tabOldPrinter = {};
		var l1 = oldPrinter.length;
		for(var i = 0; i < l1; i++) {
			tabOldPrinter[oldPrinter[i].product] = oldPrinter[i].state;
		}
		var tabPrinter = {};
		var l2 = printer.length;
		for(var i = 0; i < l2; i++) {
			tabPrinter[printer[i].product] = printer[i].state;
		}
		for(var i in tabOldPrinter) {
            if (tabOldPrinter.hasOwnProperty(i)) {
				if(!tabPrinter[i]) {
					createNotif(Bbox.Messages.page_common_printer + i + ' ' + Bbox.Messages.page_common_was + ' ' + Bbox.Messages.page_common_takeoff + '.');
				}
            }
		}
		for(var i in tabPrinter) {
            if (tabPrinter.hasOwnProperty(i)) {
				if(!tabOldPrinter[i]) {
					createNotif(Bbox.Messages.page_common_printer + i + ' ' + Bbox.Messages.page_common_was + ' ' + Bbox.Messages.page_common_printerinserted + '.');
				}
            }
		}
		if(boolIndex) {
			Bbox.api.printer.get(printerInfo);
		}
		oldPrinter = printer;
	}
}

var oldVoip;
var updateVoip = function(voip) {
	if(!oldVoip) {
		oldVoip = voip;
	}
	if(JSON.stringify(voip) !== JSON.stringify(oldVoip)) {
		var length = voip.length;
		for(var i = 0; i < length; i++) {
		    
		    var inst = i+1;
			if(voip[i].status !== oldVoip[i].status) {
				createNotif(Bbox.Messages.page_common_phoneline + (i + 1) + ' est ' + (voip[i].status === 'Up' ? Bbox.Messages.page_common_phoneenable : Bbox.Messages.page_common_phonedisable));
			}
		    if(voip[i].callstate !== oldVoip[i].callstate) {
				var state;
				if(voip[i].callstate === 'Connecting') {
				    if (voip.length > 1 ) state = Bbox.Messages.page_common_linepending + (i + 1)
				    else state = Bbox.Messages.page_common_callpending;
				}
				else if(voip[i].callstate === 'InCall') {
				    if (voip.length > 1 ) state = Bbox.Messages.page_common_linecpending + (i + 1);
				    else state = Bbox.Messages.page_common_cpending;
				}
				else if(voip[i].callstate === 'Ringing') {
				    if (voip.length > 1 ) state = Bbox.Messages.page_common_linering + (i + 1);
				    else state = Bbox.Messages.page_common_ring;
					
				}else if(voip[i].callstate === 'OffHook') {
				    if (voip.length > 1 ) state = Bbox.Messages.page_common_linetel + (i + 1) + ' ' + Bbox.Messages.page_common_offhook;
				    else state = Bbox.Messages.page_common_phoneoffhook
				}
		        if (state) {
		        	createNotif(state);
		        }
			}
			if(voip[i].message > oldVoip[i].message) {
				createNotif((voip[i].message - oldVoip[i].message) + ' message' + ((voip[i].message - oldVoip[i].message) > 1 ? 's' : '')  + ' sur le répondeur');
			}
		}
		oldVoip = voip;
	}
};

var getOptions = function() {
	var options = JSON.parse(localStorage.getItem('options-bbox'));
	if(!options) {
		options = {};
	}
	if(options.address === undefined) {
		options.address = "http://192.168.1.254"
	}
	if(getUndefined(options.wireless)) {
		options.wireless = true;
	}
	if(getUndefined(options.display)) {
		options.display = true;
	}
	if(getUndefined(options.voip)) {
		options.voip = true;
	}
	if(getUndefined(options.hosts)) {
		options.hosts = true;
	}
	if(getUndefined(options.service)) {
		options.service = true;
	}
	if(getUndefined(options.usb)) {
		options.usb = true;
	}
	if(getUndefined(options.printer)) {
		options.printer = true;
	}
	if(getUndefined(options.iptv)) {
		options.iptv= true;
	}
	if(getUndefined(options.refresh)) {
		options.refresh = 3;
	}
	if(getUndefined(options.refreshTest)) {
		options.refreshTest = 1;
	}
	if(getUndefined(options.refreshWifi)) {
		options.refreshWifi = 1;
	}
	if(getUndefined(options.error)) {
		options.error = 1;
	}
	if(getUndefined(options.event)) {
		options.event = 1;
	}
	if(getUndefined(options.mydevice)) {
		options.mydevice = 1;
	}
	if(getUndefined(options.mydeviceBG)) {
		options.mydeviceBG = "blue";
	}
	if(getUndefined(options.mydeviceColor)) {
		options.mydeviceColor = "white";
	}
	if(getUndefined(options.otherdevice)) {
		options.otherdevice = 1;
	}
	if(getUndefined(options.otherdeviceBG)) {
		options.otherdeviceBG = "#1F1F1F";
	}
	if(getUndefined(options.otherdeviceColor)) {
		options.otherdeviceColor = "white";
	}
	localStorage.setItem('options-bbox', JSON.stringify(options));
	return options;
};

var getUndefined = function(option) {
	return option === undefined || option === 'undefined';
};

var summary = {};
var initsummary = function(response) {
	var options = getOptions();
	summary = response;
	if(response.error === undefined) {
    	var diags = response[0].diags;
        var host = response[0].hosts;
        var printer = response[0].usb.printer;
        var usb = response[0].usb.storage;
        var display = response[0].display.state;
        var iptv = response[0].iptv;
        var services = response[0].services;
        var wireless = response[0].wireless;
        var voip = response[0].voip;
        var wan = response[0].wan.ip.stats;

        if(options.usb) updateUsb(usb);
        if(options.hosts) updateHost(host);
        if(options.display) updateDisplay(display);
        if(options.iptv) updateIptv(iptv, host);
        if(options.service) updateServices(services);
        if(options.wireless) updateWireless(wireless, display);
        if(options.printer) updatePrinter(printer);
        if(options.voip) updateVoip(voip);
	}
    if(options.refresh) {
        setTimeout(function() {
        	  api.summary(initsummary);
          }, options.refresh * 1000);
    }
};

var oldTick;
var testsCallback = function(response) {
	if(response.error === undefined) {
	    var tests = response[0].diags;
	    var tabTest = ['ping','dns','http'];
	    var maxValue = 999999999999999999;
	    var tick = {ping : false, 
	                dns:false, 
	                http:false};
	    var result = {
	            dns:{
	                status: false
	                },    
	            ping:{
	                status: false
	                },    
	            http:{
	                status: false
	                }    
	    };
	    var length = tabTest.length;
	    var boolRunning = false;
	    for(var j=0;j<length;j++) {
	        var nb = 0;
	        var length2 = tests[tabTest[j]].length;
	        for(var i=0;i<length2;i++) {
	            if(tests[tabTest[j]][i].status === 'OK') {
	            	result[tabTest[j]].status = true;
	            }
	        }
	        if(result[tabTest[j]].status) {
	            tick[tabTest[j]] = true;
	        }
	    }
	    length = tabTest.length;
    	boolError = false;
	    for(i=0;i<length;i++) {
	        if(!tick[tabTest[i]] && oldTick && oldTick[tabTest[i]]) {
	        	boolError = true;
	            createNotif('Le test ' + tabTest[i].toUpperCase() + ' a échoué');
	        }
	        else if(tick[tabTest[i]] && oldTick && !oldTick[tabTest[i]]) {
	            createNotif('Le test ' + tabTest[i].toUpperCase() + ' a réussi');
	        }
	    }
	    if(boolError) {
    		chrome.browserAction.setIcon({
                path: '/logo-bbox-error.png'
            });
	    }
	    if(oldTick !== tick) {
	    	oldTick = tick;
	    }
    }
    var refreshTest = getOptions().refreshTest;
    if(refreshTest) {
    	refreshTest *= 60000;
        setTimeout(function() {
    	    api.diags(testsCallback);
        }, refreshTest);
    }
};

var oldRSSI = {};
var updateRSSI = function(response) {
	if(response.error === undefined) {
		var RSSI = {};
		var list = response[0].hosts.list;
		var l = list.length;
		for(var i = 0; i < l; i++) {
			var val = 0;
            if (list[i].wireless.rssi0 <= -75) {
            	val = 0;
            } 
            else if (list[i].wireless.rssi0 <= -60) {
            	val = 1;
            } 
            else {
            	val = 2;
            }
			RSSI[list[i].macaddress] = {
					rssi: list[i].wireless.rssi0, 
					val: val, 
					hostname: list[i].hostname, 
					macaddress: list[i].macaddress, 
					ipaddress: list[i].ipaddress
			};
		}
		if(oldRSSI !== RSSI) {
			for(var k in RSSI) {
				if(oldRSSI[k]) {
					if(RSSI[k].val !== oldRSSI[k].val) {
						var msg = 'Le RSSI du périphérique ';
						msg += (oldRSSI[k].hostname ? oldRSSI[k].hostname : oldRSSI[k].ipaddress) + ' ';
						msg += ' est passé de ' + oldRSSI[k].rssi + ' dbm';
						msg += getQual(oldRSSI[k].val);
						msg += ' à ' + RSSI[k].rssi + ' dbm';
						msg += getQual(RSSI[k].val);
						var type = "otherdevice";
						console.log(me, RSSI[k].macaddress)
						if(me === RSSI[k].macaddress) {
							type = "mydevice";
						}
						createNotif(msg, type);
					}
				}
			}
		}
		oldRSSI = RSSI;
	}
    var refreshWifi = getOptions().refreshWifi;
    if(refreshWifi > 0) {
    	refreshWifi *= 60000;
        setTimeout(function() {
        	if(getOptions().wireless) {
            	api.network_devices.get(updateRSSI);
        	}
        }, refreshWifi);
    }
};

var getQual = function(val) {
	var msg = '';
	if(val === 0) {
		msg = ' (Qualité faible)';
	}
	else if(val === 1) {
		msg = ' (Qualité moyenne)';
	}
	else if(val === 2) {
		msg = ' (Qualité élevée)';
	}
	return msg;
} 

api.summary(initsummary);

api.diags(testsCallback);

api.network_devices.get(updateRSSI);

chrome.browserAction.onClicked.addListener(function () {
	chrome.tabs.create({ url: getOptions().address});
});

var me;
api.network_devices.me(function(response) {
	if(response.error === undefined) {
		me = response[0].host.macaddress;
	}
});