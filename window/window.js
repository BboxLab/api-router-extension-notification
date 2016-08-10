var msg = location.hash.substr('#msg/'.length);
alertify.log(decodeURI(msg), "", 0);