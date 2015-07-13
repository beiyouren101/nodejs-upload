var http = require('http');
var fs = require('fs');
var path = require('path');
var Bufferhelper = require('bufferhelper');
var Buf = require('buffer');
var bufhelper = new Bufferhelper();
var _defaultPath = 'D:\';

http.createServer(function (req, res) {
	req.on('data', function (chunk) {
		bufhelper.concat(chunk);
	});
	req.on('end', function () {
		var buffer = bufhelper.toBuffer();
		bufhelper.empty();

		var str = buffer.toString();
		var re = / name="(\w+\b)"\r\n\r\n(.+(\.\w+)*)\r\n-/g;
		var array = new Array(3);
		var r = null;
		while (r = re.exec(str)) {
			array[r[1]] = r[2];
		}
		var filename = array.filename;
		var curPiece = array.curPiece;
		var pieceCount = array.pieceCount;
		var spliter = str.match(/-{29}[0-9a-zA-Z]+\r\n/g);
		var spbuf = new Buffer(spliter[0], 'utf-8');
		var count = 0,
			startindex = 0,
			endindex = buffer.length,
			i = 0,
			j = 0;
		for (i = 0; i < buffer.length; i++) {
			if (buffer[i] != spbuf[0]) {
				continue;
			}
			for (j = 0; j < spbuf.length; j++) {
				if (buffer[i + j] != spbuf[j]) {
					break;
				}
			}
			if (j == spbuf.length) {
				i = i + j - 1;
				count++;
			}
			if (count == 4) {
				break;
			}
		}
		for (i = i; i < buffer.length; i++) {
			if (buffer[i] != 0x0D) {
				continue;
			}
			if (buffer[i + 1] == 0x0A && buffer[i + 2] == 0x0D && buffer[i + 3] == 0x0A) {
				startindex = i + 4;
				break;
			}
		}

		for (i = buffer.length - 1; i >= startindex; i--) {
			if (buffer[i] != 0x2d) {
				continue;
			}
			for (j = 0; j < 29; j++) {
				if (buffer[i - j] != 0x2d) {
					break;
				}
			}
			if (j == 29) {
				endindex = i - 30;
				break;
			}
		}
		buffer = buffer.slice(startindex, endindex);

		var filePath = path.join(_defaultPath, filename);
		var tempPath = path.join(_defaultPath, path.basename(filePath, path.extname(filePath)) + '_temp.data');
		var nxtPiece = 1;
		fs.exists(filePath, function (fexists) {
			fs.exists(tempPath, function (texists) {
				if (!texists && !fexists) {
					fs.closeSync(fs.openSync(filePath, 'w', '0666'));
					var fd = fs.openSync(tempPath, 'w', '0666');
					fs.WriteSync(fd, '1', 0, 'utf-8');
					fs.closeSync(fd);
				}
				if (fexists && texists) {
					var nxtPiece;
					var trstream = fs.createReadStream(tempPath);
					trstream.on("data", function (chunk) {
						nxtPiece += chunk;
					});
					trstream.on("end", function () {
						nxtPiece = parseInt(nxtPiece);
						if (nxtPiece == curPiece) {


							var aOption = {
								flag: 'a',
								encoding: null,
								mode: '0666'
							};
							var wstream = fs.createWriteStream(filePath, aOption);
							wstream.on('drain', function () {
								wstream.end();
								if (nxtPiece == pieceCount) {
									fs.rmdir(tempPath, function (err) {
										if (err) {
											console.log(err.message);
										}
									});
									nxtPiece++;
								} else {
									trstream.pipe()
								}
								var obj = '{' + '"nxtPiece":' + nxtPiece + '}';
								res.writeHead(200, {
									'Content-Length': obj.toString().length,
									'Content-Type': 'text/plain',
									'Access-Control-Allow-Origin': '*'
								});
								res.write(obj, 'utf-8');
								res.end();
							});
							wstream.write(buffer);

						}
					});
				} else {

				}
			});
		});

	});
}).listen(3000);
console.log("HTTP server is listening at port 3000.");