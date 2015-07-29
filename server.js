var http = require('http');
var fs = require('fs');
var path = require('path');
var Bufferhelper = require('bufferhelper');
var Buf = require('buffer');
var bufhelper = new Bufferhelper();
//var math = require('math');
var _defaultPath = 'D:\\';
var stepSize = 1024 * 1024 * 1;
var filename, curPiece, pieceCount, buffer, filePath, tempPath, nxtPiece, tempdata;

function procData(res) {
	var trstream = fs.createReadStream(tempPath);
	trstream.on("data", function (chunk) {
		bufhelper.concat(chunk);
	});
	trstream.on("end", function () {
		console.log('read temp ok!');
		tempdata = bufhelper.toBuffer();
		bufhelper.empty();
		nxtPiece = parseInt(tempdata.toString());
		console.log(nxtPiece);
		if (nxtPiece == curPiece) {
			var aOption = {
				flag: 'a',
				encoding: null,
				mode: '0666'
			};
			var wstream = fs.createWriteStream(filePath, aOption);
			wstream.write(buffer);
			wstream.end();
			if (nxtPiece == pieceCount) {
				fs.unlink(tempPath, function (err) {
					if (err) {
						console.log(err.message);
						return;
					}
				});
				nxtPiece++;
				var obj = '{' + '"nxtPiece":' + nxtPiece + '}';
				res.writeHead(200, {
					'Content-Length': obj.toString().length,
					'Content-Type': 'text/plain',
					'Access-Control-Allow-Origin': '*'
				});
				res.write(obj, 'utf-8');
				res.end();
			} else {
				nxtPiece++;
				buffer = new Buffer(nxtPiece, 'utf-8');
				console.log(nxtPiece);
				fs.unlink(tempPath, function (err) {
					if (err) {
						console.log(err.message);
					}
					fs.open(tempPath, 'w', '0666', function (err, fd) {
						if (err) {
							console.log(err.message);
						}
						fs.close(fd, function (err) {
							if (err) {
								console.log(err.message);
							}
							var twstream = fs.createWriteStream(tempPath);
							twstream.write(buffer);
							twstream.end();
							var obj = '{' + '"nxtPiece":' + nxtPiece + '}';
							res.writeHead(200, {
								'Content-Length': obj.toString().length,
								'Content-Type': 'text/plain',
								'Access-Control-Allow-Origin': '*'
							});
							res.write(obj, 'utf-8');
							res.end();
						});
					});
				});
			}
		} else {
			var obj = '{' + '"nxtPiece":' + nxtPiece + '}';
			res.writeHead(200, {
				'Content-Length': obj.toString().length,
				'Content-Type': 'text/plain',
				'Access-Control-Allow-Origin': '*'
			});
			res.write(obj, 'utf-8');
			res.end();
		}
	});
}

http.createServer(function (req, res) {
	req.on('data', function (chunk) {
		bufhelper.concat(chunk);
	});
	req.on('end', function () {
		buffer = bufhelper.toBuffer();
		bufhelper.empty();

		var str = buffer.toString();
		var re = / name="(\w+\b)"\r\n\r\n(.+(\.\w+)*)\r\n-/g;
		var array = new Array(3);
		var r = null;
		while (r = re.exec(str)) {
			array[r[1]] = r[2];
		}
		filename = array.filename;
		curPiece = parseInt(array.curPiece);
		pieceCount = parseInt(array.pieceCount);
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

		filePath = path.join(_defaultPath, filename);
		tempPath = path.join(_defaultPath, path.basename(filePath, path.extname(filePath)) + '_temp.data');
		nxtPiece = 1;
		fs.exists(filePath, function (fexists) {
			fs.exists(tempPath, function (texists) {
				if (!texists && !fexists) {
					fs.open(filePath, 'w', '0666', function (err, fd) {
						if (err) {
							console.log(err.message);
							return;
						}
						console.log('create file ok!');
						fs.close(fd, function (err) {
							if (err) {
								console.log(err.message);
							}
							console.log('close file ok!');
							fs.open(tempPath, 'w', '0666', function (err, fd) {
								if (err) {
									console.log(err.message);
								}
								console.log('create temp ok!');
								fs.close(fd, function (err) {
									if (err) {
										console.log(err.message);
									}
									console.log('close temp ok!');
									var twstrm = fs.createWriteStream(tempPath);
									console.log('begin init temp:')
									twstrm.write(new Buffer('1', 'utf-8'));
									console.log('end write temp!');
									twstrm.end();
									procData(res);
								});
							});
						});
					});
				}
				if (fexists && texists) {
					console.log('both exists!')
					procData(res);
				} else {
					// 原文件已传输完或临时文件丢失
					fs.stat(filePath, function (err, stats) {
						var filesize = stats.size;
						//var filePieceCount = math.ceil(filesize / stepSize);
					});
				}
			});
		});

	});
}).listen(3000);
console.log("HTTP server is listening at port 3000.");


function writeOneMillionTimes(writer, data, encoding, callback) {
	var i = 1000000;
	write();

	function write() {
		var ok = true;
		do {
			i -= 1;
			if (i === 0) {
				// last time!
				writer.write(data, encoding, callback);
			} else {
				// see if we should continue, or wait
				// don't pass the callback, because we're not done yet.
				ok = writer.write(data, encoding);
			}
		} while (i > 0 && ok);
		if (i > 0) {
			// had to stop early!
			// write some more once it drains
			writer.once('drain', write);
		}
	}
}