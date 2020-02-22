import * as ethers from "ethers";
import { getChainData } from "./utilities";
import { setLocal, getLocal } from "./local";
import {
  STANDARD_PATH,
  ENTROPY_KEY,
  MNEMONIC_KEY,
  DEFAULT_ACTIVE_INDEX,
  DEFAULT_CHAIN_ID,
} from "./constants";
import * as starkwareCrypto from "./starkware";

let path: string | null = null;
let entropy: string | null = null;
let mnemonic: string | null = null;
let activeIndex: number = DEFAULT_ACTIVE_INDEX;
let activeChainId: number = DEFAULT_CHAIN_ID;
let wallet: ethers.Wallet | null = null;
let starkKeyPair: starkwareCrypto.KeyPair | null = null;

export function isWalletActive() {
  if (!wallet) {
    return wallet;
  }
  return null;
}

export async function getWallet(index?: number, chainId?: number): Promise<ethers.Wallet> {
  let _wallet = wallet;
  if (!_wallet || activeIndex === index || activeChainId === chainId) {
    _wallet = await initWallet(index, chainId);
  }
  return _wallet;
}

export function getAccounts(count = 2) {
  const accounts = [];
  let wallet = null;
  for (let i = 0; i < count; i++) {
    wallet = generateWallet(i);
    accounts.push(wallet.address);
  }
  return accounts;
}

export function getData(key: string): string {
  let value = getLocal(key);
  if (!value) {
    switch (key) {
      case ENTROPY_KEY:
        value = generateEntropy();
        break;
      case MNEMONIC_KEY:
        value = generateMnemonic();
        break;
      default:
        throw new Error(`Unknown data key: ${key}`);
    }
    setLocal(key, value);
  }
  return value;
}

export function generatePath(index: number) {
  path = `${STANDARD_PATH}/${index}`;
  return path;
}

export function generateEntropy(): string {
  entropy = ethers.utils.hexlify(ethers.utils.randomBytes(16));
  return entropy;
}

export function generateMnemonic() {
  mnemonic = ethers.utils.HDNode.entropyToMnemonic(getEntropy());
  return mnemonic;
}

export function generateWallet(index: number) {
  wallet = ethers.Wallet.fromMnemonic(getMnemonic(), generatePath(index));
  return wallet;
}

export async function generateStarkwareKeyPair(): Promise<starkwareCrypto.KeyPair> {
  const privateKey = (await getWallet()).privateKey;
  starkKeyPair = starkwareCrypto.ec.keyFromPrivate(privateKey, "hex");
  return starkKeyPair;
}

export function getEntropy(): string {
  return getData(ENTROPY_KEY);
}

export function getMnemonic(): string {
  return getData(MNEMONIC_KEY);
}

export async function getStakwareKeyPair(): Promise<starkwareCrypto.KeyPair> {
  let keyPair = starkKeyPair;
  if (!keyPair) {
    keyPair = await generateStarkwareKeyPair();
  }
  return keyPair;
}

export async function getStarkKey() {
  const keyPair = await getStakwareKeyPair();
  const publicKey = starkwareCrypto.ec.keyFromPublic(keyPair.getPublic(true, "hex"), "hex");
  const starkKey = (publicKey as any).pub.getX();
  return starkKey;
}

export async function initWallet(index = DEFAULT_ACTIVE_INDEX, chainId = DEFAULT_CHAIN_ID) {
  return updateWallet(index, chainId);
}

export async function updateWallet(index: number, chainId: number) {
  activeIndex = index;
  activeChainId = chainId;
  const rpcUrl = getChainData(chainId).rpc_url;
  wallet = generateWallet(index);
  await generateStarkwareKeyPair();
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  wallet.connect(provider);
  return wallet;
}

export async function sendTransaction(transaction: any) {
  if (wallet) {
    if (transaction.from && transaction.from.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error("Transaction request From doesn't match active account");
    }

    if (transaction.from) {
      delete transaction.from;
    }

    // ethers.js expects gasLimit instead
    if ("gas" in transaction) {
      transaction.gasLimit = transaction.gas;
      delete transaction.gas;
    }

    const result = await wallet.sendTransaction(transaction);
    return result.hash;
  } else {
    console.error("No Active Account");
  }
  return null;
}

export async function signTransaction(data: any) {
  if (wallet) {
    if (data && data.from) {
      delete data.from;
    }
    const result = await wallet.sign(data);
    return result;
  } else {
    console.error("No Active Account");
  }
  return null;
}

export async function signMessage(data: any) {
  if (wallet) {
    const signingKey = new ethers.utils.SigningKey(wallet.privateKey);
    const sigParams = await signingKey.signDigest(ethers.utils.arrayify(data));
    const result = await ethers.utils.joinSignature(sigParams);
    return result;
  } else {
    console.error("No Active Account");
  }
  return null;
}

export async function signPersonalMessage(message: any) {
  if (wallet) {
    const result = await wallet.signMessage(
      ethers.utils.isHexString(message) ? ethers.utils.arrayify(message) : message,
    );
    return result;
  } else {
    console.error("No Active Account");
  }
  return null;
}

export async function starkwareSign(msg: any) {
  const keyPair = await getStakwareKeyPair();
  return starkwareCrypto.sign(keyPair, msg);
}

export async function starkwareVerify(msg: any, sig: any) {
  const keyPair = await getStakwareKeyPair();
  return starkwareCrypto.verify(keyPair, msg, sig);
}
