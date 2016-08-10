var background = chrome.extension.getBackgroundPage();
var options = background.getOptions();
var list = document.querySelectorAll('[id]');
var l = list.length;
for(var i = 0; i < l; i++) {
	if(list[i].tagName === 'INPUT' && list[i].getAttribute('type') === 'checkbox') {
		list[i].checked = options[list[i].getAttribute('id')];
	}
	else {
		document.getElementById(list[i].getAttribute('id')).value = options[list[i].getAttribute('id')];
	}
}

document.getElementById('refreshTest').value = options.refreshTest;

document.getElementById('submit').addEventListener('click', function() {
	var obj = {};
	var list = document.querySelectorAll('[id]');
	var l = list.length;
	for(var i = 0; i < l; i++) {
		if(list[i].tagName === 'INPUT' && list[i].getAttribute('type') === 'checkbox') {
			obj[list[i].getAttribute('id')] = list[i].checked;
		}
		else {
			obj[list[i].getAttribute('id')] = list[i].value;
		}
	}
	localStorage.setItem('options-bbox', JSON.stringify(obj));
});


var checkAll = function(type) {
	document.getElementById(type).addEventListener('click', function() {
		var list = document.querySelectorAll('#div-' + type + ' + .margin-32 input[type="checkbox"]');
		var l = list.length;
		for(var i = 0; i < l; i++) {
			list[i].checked = this.checked;
		}
	});
}

checkAll('error');
checkAll('event');

var checkParent = function(type) {
	var list = document.querySelectorAll('#div-' + type + ' + .margin-32 input[type="checkbox"]');
	var l = list.length;
	for(var i = 0; i < l; i++) {
		list[i].addEventListener('click', function() {
			var checked = false;
			for(var j = 0; j < l; j++) {
				if(list[j].checked) {
					checked = true;
					break;
				}
			}
			document.getElementById(type).checked = checked;
		});
	}
}
checkParent('error');
checkParent('event');
