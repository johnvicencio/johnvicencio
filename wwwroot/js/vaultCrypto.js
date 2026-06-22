window.johnvicencioVault = {
  async decrypt(saltBase64, ivBase64, cipherTextBase64, tagBase64, iterations, passphrase) {
    const salt = fromBase64(saltBase64);
    const iv = fromBase64(ivBase64);
    const cipherText = fromBase64(cipherTextBase64);
    const tag = fromBase64(tagBase64);
    const encrypted = concatBytes(cipherText, tag);
    const passphraseBytes = new TextEncoder().encode(passphrase);

    const baseKey = await crypto.subtle.importKey(
      "raw",
      passphraseBytes,
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations
      },
      baseKey,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["decrypt"]
    );

    const plainText = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        tagLength: tag.length * 8
      },
      key,
      encrypted
    );

    passphraseBytes.fill(0);
    return new TextDecoder().decode(plainText);
  },

  async encrypt(plaintext, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 600000;
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const passphraseBytes = new TextEncoder().encode(passphrase);

    const baseKey = await crypto.subtle.importKey(
      "raw", passphraseBytes, "PBKDF2", false, ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      plaintextBytes
    );

    const encryptedBytes = new Uint8Array(encrypted);
    const cipherText = encryptedBytes.slice(0, -16);
    const tag = encryptedBytes.slice(-16);

    passphraseBytes.fill(0);

    return {
      salt: toBase64(salt),
      iv: toBase64(iv),
      cipherText: toBase64(cipherText),
      tag: toBase64(tag),
      iterations
    };
  }
};

function toBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function concatBytes(first, second) {
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);
  return combined;
}
