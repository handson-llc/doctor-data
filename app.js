const puppeteer = require('puppeteer')
const fs = require("fs");

// Util
function writeFile(path, data) {
	const jsonStr = JSON.stringify(data, "", " ");
	fs.writeFile(path, jsonStr, (err) => {
		if (err) rej(err);
		if (!err) {
			console.log('write json complete.');
			console.log(data);
		}
	});
}

// Tips
// ローカル環境などでPuppeteerを利用する場合、
// const browser = await puppeteer.launch();
// CircleCIでPuppeteerを利用する場合、
//const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });


function randomWait(millisec = 500){
	return Math.random() * millisec;
}

// main
(async () => {
	console.log("start")
	//const browser = await puppeteer.launch();
	//const browser = await puppeteer.launch({headless: false}) // { headless: false } : フルバージョンのChromeを使用するオプション
	const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
	const page = await browser.newPage()
	const width = 1358, height = 1920

	top_url = "https://www.jra.go.jp/datafile/meikan/trainer.html"
	output_file = "data/horse.json"
	timeout = 2500

	try {
		// --------------------
		// ブラウザの設定
		// --------------------
		await page.setViewport({ width, height })

		let trainer_list = []
		for (let initial_index = 0; initial_index < 10; initial_index++){
			console.log(initial_index)

			// トップページ
			await Promise.all([
				page.waitForNavigation({ waitUntil: 'networkidle0' }), // コネクション数0が500ms続くまで
				page.goto(top_url,  {waitUntil: "domcontentloaded"})
			])
			await page.waitForTimeout(timeout + randomWait());

			const initial_list = await page.$$(".initial_list > ul > li > a")
			let element = initial_list[initial_index]
			element.click()
			await page.waitForTimeout(timeout + randomWait());

			const name_list = await page.$$(".name_list > ul > li > div > div > ul > li > a")
			await page.waitForTimeout(timeout + randomWait());
			let name_num = name_list.length
			
			for(let name_index = 0; name_index < name_num; name_index++){
				// 各ループの中でトップページからアクセスしなおし（疑似POSTリクエストを使うサイトのため）
				await Promise.all([
					page.waitForNavigation({ waitUntil: 'networkidle0' }), // コネクション数0が500ms続くまで
					page.goto(top_url,  {waitUntil: "domcontentloaded"})
				])
				await page.waitForTimeout(timeout + randomWait());
				// 調教師のイニシャル
				const initial_list2 = await page.$$(".initial_list > ul > li > a")
				initial_list2[initial_index].click()
				await page.waitForTimeout(timeout + randomWait());
				// 名前を選択
				const name_list2 = await page.$$(".name_list > ul > li > div > div > ul > li > a")
				name_list2[name_index].click()
				await page.waitForTimeout(timeout + randomWait());
				// 場名を取得
				const field_li = await page.$$("div.data > ul > li")
				const field_dd = await field_li[3].$("dl > dd")
				const field_text = await (await field_dd.getProperty('textContent')).jsonValue()
				let field_name = ""
				if (field_text.includes("美浦") || field_text.includes("栗東")){
					field_name = field_text.trim()
				}
				// 馬一覧を選択
				const link_list = await page.$$(".link_list > li > a")
				link_list[4].click()
				await page.waitForTimeout(timeout + randomWait());

				// 調教師情報
				const trainer = await page.$(".header_line > div > h1 > span > span.txt")
				const trainer_text = await (await trainer.getProperty('textContent')).jsonValue()
				const trainer_name = trainer_text.replace(/管理馬一覧/g, "")
				console.log(name_index + ", " + trainer_name)

				// 馬の情報取得
				let horse_list = []
				const rows = await page.$$("tbody > tr")
				for(let row of rows){
					const horse_name = await (await (await row.$("th")).getProperty('textContent')).jsonValue()
					const horse_age = await (await (await row.$("td")).getProperty('textContent')).jsonValue()
					let horse_state = ""
					let td = await row.$$("td")
					if(td.length > 1){
						horse_state = await (await td[1].getProperty('textContent')).jsonValue()
					}
					horse_list.push([horse_name, horse_age, horse_state])
				}
				trainer_list.push({ name: trainer_name, field: field_name, list: horse_list })
				//if(name_index >= 0) break // for debug
			}
			//if(initial_index >= 0) break // for debug
		}

		let json_data = []
		for(let array of trainer_list){
			let data = {
				name: array["name"],
				field: array["field"],
				list: array["list"]
			}
			json_data.push(data)
		}

		console.log(json_data)

		writeFile(output_file, json_data)

		return 

	} catch (err) {
		console.log(err)
	} finally {
		await browser.close()
		console.log("done")
	}
})();
