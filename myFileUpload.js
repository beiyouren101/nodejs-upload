var pieceSize = 1024 * 1024 * 1;


function fileSelected() {
	document.getElementById('fileInfo').innerHTML = '';
	var event = arguments.callee.caller.arguments[0] || event;
	var evt = event.srcElement || event.target;
	var fileCount = evt.files.length;
	for (var i = 0; i < fileCount; i++) {
		var file = evt.files[i];
		var fileSize = 0;
		if (file.size > 1024 * 1024 * 1024) {
			fileSize = (Math.round(file.size * 100 / (1024 * 1024 * 1024)) / 100).toString() + 'GB';
		} else if (file.size > 1024 * 1024) {
			fileSize = (Math.round(file.size * 100 / (1024 * 1024)) / 100).toString() + 'MB';
		} else {
			fileSize = (Math.round(file.size * 100 / 1024) / 100).toString() + 'KB';
		}
		var fileinfo = '<ul><li>Name: ' + file.name + '</li><li>Size: ' + fileSize + '</li><li>Type: ' + file.type + '</li></ul>';
		document.getElementById('fileInfo').innerHTML += fileinfo;
	}
}

function uploadFileWhole(file) {
	var xhr = new XMLHttpRequest();

	var fileinfo = {
		filename: file.name,
		filesize: file.size
	};
	xhr.open('post', '../Home/SetFileInfo', true);
	xhr.responseType = 'json';
	xhr.send(JSON.stringify(fileinfo));

	var isok = false;
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			console.log(xhr.responseText);
			isok = !isok;
			if (isok) {
				xhr.open("POST", "../Home/MyUpload", true);
				xhr.send(file);
			}
		}
	}
}

function uploadFilePieceByBlob(file) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			var index = xhr.response.index;
			console.log(index / 1024 / 1024 + '    ' + index);
			if (index < file.size) {
				var lastindex = index + pieceSize;
				lastindex = lastindex < file.size ? lastindex : file.size;
				var blob = file.slice(index, lastindex);
				xhr.open('post', '../Home/TransferData', true);
				xhr.responseType = 'json';
				xhr.send(blob);
			}
		}
	}
	var fileinfo = {
		filename: file.name,
		filesize: file.size
	};
	xhr.open('post', '../Home/SetFileInfo', true);
	xhr.responseType = 'json';
	xhr.send(JSON.stringify(fileinfo));
	console.log(file.size);
}

function uploadFilePieceByFormData(file) {
	var pieceCount = Math.ceil(file.size / pieceSize);
	var url = 'http://localhost:3000';
	//var url = '../Home/UploadByPiece';
	var xhr = new XMLHttpRequest();
	xhr.responseType = 'json';
	var index = 1;
	var formdata = new FormData();
	formdata.append("filename", file.name);
	formdata.append("pieceCount", pieceCount);
	formdata.append("curPiece", index);
	formdata.append("data", file.slice((index - 1) * pieceSize, index * pieceSize));
	xhr.open("POST", url, true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			var result = xhr.response;
			console.log(result.nxtPiece);
			index = result.nxtPiece - 1;
			index++;
			if (index <= pieceCount) {
				formdata = new FormData();
				formdata.append("filename", file.name);
				formdata.append("pieceCount", pieceCount);
				formdata.append("curPiece", index);
				formdata.append("data", file.slice((index - 1) * pieceSize, index * pieceSize));
				xhr.open("POST", url, true);
				xhr.send(formdata);
			}
		}
	}
	xhr.send(formdata);
}

function nodeUploadWholeByFormData(file) {
	var formdata = new FormData();
	formdata.append("filename", file.name);
	formdata.append("pieceCount", 1);
	formdata.append("curPiece", 1);
	formdata.append("data", file);
	var xhr = new XMLHttpRequest();
	xhr.responseType = 'json';
	xhr.open("POST", "http://localhost:3000", true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			console.log(xhr.response.nxtPiece);
		}
	}
	xhr.send(formdata);
}

function nodeUploadWhole(file) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "http://localhost:3000", true);
	xhr.onreadystatechange = function () {
		if (xhr.readyState == 4 && xhr.status == 200) {
			console.log(xhr.responseText);
		}
	}
	xhr.send(file);
}

function uploadfiles() {
	var files = document.getElementById("fileToUpload").files;
	for (var i = 0; i < files.length; i++) {
		uploadFilePieceByFormData(files[i]);
	}
	console.log('upload success.')

}