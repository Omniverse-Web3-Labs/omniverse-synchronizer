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
    result.push(parseInt(hexString.substring(i, 2), 16));
  }
  return result;
}

export { sleep, hexStringtoBytesArray };
