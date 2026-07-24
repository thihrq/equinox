declare const require: (moduleName: string) => any;
declare const process: { exitCode?: number };

const fs = require('fs') as any;
const path = require('path') as any;
const file = path.resolve('src/equinox/data-packs/competitive/champions-reg-mb-doubles/natures.json');
const values = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).natures : [];
const ids = new Set(values.map((item: any) => item.natureId));
const valid = values.length === 25 && ids.size === 25 && values.every((item: any) => item.increasedStat !== 'hp' && item.decreasedStat !== 'hp' && (item.isNeutral ? item.increasedStat === null && item.decreasedStat === null : item.increasedStat !== item.decreasedStat));
console.log(JSON.stringify({ valid, count: values.length, uniqueIds: ids.size, neutralCount: values.filter((item: any) => item.isNeutral).length }, null, 2));
if (!valid) process.exitCode = 1;
