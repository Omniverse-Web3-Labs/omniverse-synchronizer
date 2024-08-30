export * from './ethereum';
export * from './types';

async function sleep(seconds: number) {
  await new Promise((resolve: any) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}

function hexStringtoBytesArray(hexString: string) {
  if (hexString.substring(0, 2) == '0x') {
    hexString = hexString.substring(2);
  }

  let result = [];
  for (let i = 0; i < hexString.length; i += 2) {
    result.push(parseInt(hexString.substring(i, i + 2), 16));
  }
  return result;
}

function toObject(data: any, key: any): any {
  if (Array.isArray(data)) {
    return data.map((item: any) => toObject(item, key));
  } else if (typeof data === 'object' && data !== null) {
    const filteredData: any = {};
    Object.keys(data).forEach((key: any) => {
      if (isNaN(key) && key !== '__length__') {
        filteredData[key] = toObject(data[key], key);
      }
    });
    return filteredData;
  } else if (typeof data === 'bigint') {
    if (key == 'index') {
      return Number(data);
    }
    return data.toString();
  } else {
    return data;
  }
}

export { sleep, hexStringtoBytesArray, toObject };
