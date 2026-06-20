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
  }
};

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
