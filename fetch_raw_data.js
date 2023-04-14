const axios = require("axios");
const fs = require("fs");

let time = Math.round(new Date("2023-04-14 23:37").getTime() / 1000);

if (!fs.existsSync("./data")) fs.mkdirSync("./data");

setInterval(() => {
	setTimeout(() => {
		axios.post("https://palert.earth.sinica.edu.tw/graphql/", { "query": "query($recordTime:Int){realtimePGA(recordTime:$recordTime){\npgaVals\ntimestamp\n}}", "variables": { "recordTime": time } })
			.then((res) => {
				fs.writeFile(`./data/${time}.json`, JSON.stringify(res.data.data.realtimePGA.pgaVals), () => {
					console.log(Full(time * 1000));
					time++;
				});
			}).catch((err) => void 0);
	}, 1000 - new Date().getMilliseconds());
}, 1000);

function Full(_time = Date.now()) {
	const now = new Date(_time);
	return now.getFullYear() +
        "/" + (now.getMonth() + 1) +
        "/" + now.getDate() +
        " " + now.getHours() +
        ":" + now.getMinutes() +
        ":" + now.getSeconds() +
        "." + now.getMilliseconds();
}