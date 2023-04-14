const axios = require("axios");
const fs = require("fs");
const pointInPolygon = require("point-in-polygon");

const station = JSON.parse(fs.readFileSync("./station.json").toString());
const box_data = JSON.parse(fs.readFileSync("./box.json").toString());
const sta_lta_data = {};
const box_search_cache = {};
const alert_box = {};
const alert_box_list = [];
const alert_station_list = [];
const station_pga = {};
let lock = false;

let init_lat = 0;
let init_lon = 0;
let init_depth = 0;
let init_scale = 0;

let time = Math.round(new Date("2023-04-14 23:37").getTime() / 1000);

// setInterval(() => {
// 	setTimeout(() => {
// 		axios.post("https://palert.earth.sinica.edu.tw/graphql/", { "query": "query($recordTime:Int){realtimePGA(recordTime:$recordTime){\npgaVals\ntimestamp\n}}", "variables": { "recordTime": Math.round(Date.now() / 1000) - 1 } })
// 			.then((res) => {
// 				get_data(res.data.data.realtimePGA.pgaVals);
// 			}).catch((err) => void 0);
// 	}, 1000 - new Date().getMilliseconds());
// }, 1000);

setInterval(() => {
	if (lock) return;
	lock = true;
	fs.exists(`./data/${time}.json`, (bool) => {
		if (bool)
			fs.readFile(`./data/${time}.json`, (err, data) => {
				const json = JSON.parse(data.toString());
				get_data(json);
				time++;
				lock = false;
			});
	});
}, 10);

function get_data(palert_raw) {
	if (!Object.keys(palert_raw).length) return;
	for (let i = 0; i < Object.keys(palert_raw).length; i++) {
		const uuid = Object.keys(palert_raw)[i];
		if (!sta_lta_data[uuid]) sta_lta_data[uuid] = [];
		sta_lta_data[uuid].push(palert_raw[uuid]);
	}
	for (let i = 0; i < Object.keys(sta_lta_data).length; i++) {
		const uuid = Object.keys(sta_lta_data)[i];
		if (!palert_raw[uuid]) {
			delete sta_lta_data[uuid];
			continue;
		}
		if (sta_lta_data[uuid].length > 40) {
			sta_lta_data[uuid].splice(0, 1);
			let XA1 = 0;
			let XA2 = 0;
			for (let index = 0; index < 40; index++)
				if (index < 37) XA1 += Math.abs(sta_lta_data[uuid][index]);
				else XA2 += Math.abs(sta_lta_data[uuid][index]);
			XA1 = XA1 / 37;
			XA2 = XA2 / 3;
			if (XA2 / XA1 > 2 && palert_raw[uuid] > 0.6) {
				if (palert_raw[uuid] > (station_pga[uuid] ?? 0)) station_pga[uuid] = palert_raw[uuid];
				const box_id = box(station[uuid].lon, station[uuid].lat);
				if (alert_box[box_id] && Date.now() - alert_box[box_id].timestamp > 3000) delete alert_box[box_id];
				if (!alert_box[box_id]) alert_box[box_id] = {
					list      : [],
					timestamp : 0,
				};
				if (!alert_box[box_id].list.includes(uuid)) alert_box[box_id].list.push(uuid);
				alert_box[box_id].timestamp = Date.now();
				if (alert_box_list.includes(box_id))
					if (!alert_station_list.includes(uuid)) alert_station_list.push(uuid);
			}
		}
	}
	for (let i = 0; i < Object.keys(alert_box).length; i++) {
		const id = Object.keys(alert_box)[i];
		if (alert_box[id].list.length > 3)
			if (!alert_box_list.includes(id)) alert_box_list.push(id);
	}

	if (alert_station_list.length) {

		init_lat = station[alert_station_list[0]].lat;
		init_lon = station[alert_station_list[0]].lon;
		init_depth = 10;
		init_scale = 3;

		const range = 10;

		for (let T = 0; T < 20; T++) {
			let ans_lat = init_lat;
			let ans_lon = init_lon;
			let ans_depth = init_depth;
			let ans_scale = init_scale;
			let limit = 0;

			for (let _lat = init_lat * 100 - range; _lat < init_lat * 100 + range; _lat += 2)
				for (let _lon = init_lon * 100 - range; _lon < init_lon * 100 + range; _lon += 2) {
					const _lat_ = _lat / 100;
					const _lon_ = _lon / 100;
					for (let d = (init_depth - range < 5) ? 5 : init_depth - range; d <= init_depth + range; d += 5)
						for (let i = (init_scale - 1 < 0) ? 0 : init_scale - 1; i <= init_scale + 1; i = Number((i + 0.5).toFixed(1))) {
							let count = 0;
							for (let index = 0; index < alert_station_list.length; index++) {
								const uuid = alert_station_list[index];
								const station_info = station[uuid];
								const distance = Math.sqrt(pow(d) + pow(Math.sqrt(pow((Number(station_info.lat) + _lat_ * -1) * 111) + pow((Number(station_info.lon) + _lon_ * -1) * 101, 2))));
								const PGA = 1.657 * Math.pow(Math.E, (1.533 * i)) * Math.pow(distance, -1.607);
								count += Math.round(Math.abs(station_pga[uuid] - PGA));
							}
							if (limit == 0)
								limit = count;
							else if (count < limit) {
								ans_depth = d;
								limit = count;
								ans_scale = i;
								ans_lat = _lat_;
								ans_lon = _lon_;
							}
						}
				}
			init_lat = ans_lat;
			init_lon = ans_lon;
			init_depth = ans_depth;
			init_scale = ans_scale;
		}

		init_lat = Number(init_lat.toFixed(2));
		init_lon = Number(init_lon.toFixed(2));

		console.log(init_lat, " ", init_lon, " ", init_depth, " ", init_scale);
	}
}

function box(lon, lat) {
	if (box_search_cache[`${lon} ${lat}`]) return box_search_cache[`${lon} ${lat}`];
	for (let i = 0; i < Object.keys(box_data).length; i++) {
		const id = Object.keys(box_data)[i];
		if (pointInPolygon([ lat, lon ], box_data[id])) {
			box_search_cache[`${lon} ${lat}`] = id;
			return id;
		}
	}
	box_search_cache[`${lon} ${lat}`] = -1;
	return -1;
}

function pga_to_intensity(pga) {
	return 2 * Math.log10(pga) + 0.7;
}

function intensity_float_to_int(float) {
	return (float < 0) ? 0 : (float < 4.5) ? Math.round(float) : (float < 5) ? 5 : (float < 5.5) ? 6 : (float < 6) ? 7 : (float < 6.5) ? 8 : 9;
}

function pow(int) {
	return Math.pow(int, 2);
}