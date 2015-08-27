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
		tempdata = bufhelper.toBuffer();
		bufhelper.empty();
		nxtPiece = parseInt(tempdata.toString());
		if (nxtPiece == curPiece) {
			// 当前传输片序号正确，写入文件
			var aOption = {
				flags: 'a',
				encoding: null,
				mode: '0666'
			};
			var wstream = fs.createWriteStream(filePath, aOption);
			wstream.write(buffer);
			wstream.end();
			// 当前传输已是最后一片，则删除临时文件，返回响应
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
				// 还不是最后一片，更新片标记临时文件
				nxtPiece++;
				buffer = new Buffer(nxtPiece.toString(), 'utf-8');
				var wOption = {
					flags: 'w',
					encoding: null,
					mode: '0666'
				};
				var twstream = fs.createWriteStream(tempPath, wOption);
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
			}
		} else {
			// 接收到错误的片，返回应该接收的片的序号
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

		// 获取文件名、当前片序号，总片数
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

		// 提取内容分隔符
		var spliter = str.match(/-{29}[0-9a-zA-Z]+\r\n/g);
		var spbuf = new Buffer(spliter[0], 'utf-8');
		var count = 0,
			startindex = 0,
			endindex = buffer.length,
			i = 0,
			j = 0;
		// 从前向后遍历，过滤至第四个分隔符的结束，即指向文件内容的开始
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

		// 从后向前遍历直至最后一个分隔符的开始
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
		// 取的传输的文件数据
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
						fs.close(fd, function (err) {
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
									var twstrm = fs.createWriteStream(tempPath);
									twstrm.write(new Buffer('1', 'utf-8'));
									twstrm.end();
									procData(res);
								});
							});
						});
					});
				}
				if (fexists && texists) {
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
