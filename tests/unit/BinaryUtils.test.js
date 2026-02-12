import { describe, it, expect } from 'vitest';
import BinaryUtils from '../../js/metadata-parser/utils/BinaryUtils.js';

describe('BinaryUtils', () => {
  describe('readFourCC', () => {
    it('should read 4-byte FourCC code', () => {
      const buffer = new Uint8Array([0x50, 0x4E, 0x47, 0x0D]); // "PNG\r"
      const result = BinaryUtils.readFourCC(buffer, 0);
      expect(result).toBe('PNG\r');
    });

    it('should read FourCC at offset', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x74, 0x45, 0x58, 0x74]); // "tEXt" at offset 2
      const result = BinaryUtils.readFourCC(buffer, 2);
      expect(result).toBe('tEXt');
    });

    it('should throw error if buffer too small', () => {
      const buffer = new Uint8Array([0x50, 0x4E, 0x47]);
      expect(() => BinaryUtils.readFourCC(buffer, 0)).toThrow('Buffer too small');
    });

    it('should throw error if offset too large', () => {
      const buffer = new Uint8Array([0x50, 0x4E, 0x47, 0x0D]);
      expect(() => BinaryUtils.readFourCC(buffer, 2)).toThrow('Buffer too small');
    });
  });

  describe('readUInt32BE', () => {
    it('should read big-endian 32-bit integer', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x0D]); // 13
      const result = BinaryUtils.readUInt32BE(buffer, 0);
      expect(result).toBe(13);
    });

    it('should read large big-endian integer', () => {
      const buffer = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
      const result = BinaryUtils.readUInt32BE(buffer, 0);
      expect(result).toBe(0x12345678);
    });

    it('should read at offset', () => {
      const buffer = new Uint8Array([0xFF, 0xFF, 0x00, 0x00, 0x00, 0x0A]);
      const result = BinaryUtils.readUInt32BE(buffer, 2);
      expect(result).toBe(10);
    });

    it('should handle maximum value', () => {
      const buffer = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
      const result = BinaryUtils.readUInt32BE(buffer, 0);
      expect(result).toBe(0xFFFFFFFF);
    });

    it('should throw error if buffer too small', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00]);
      expect(() => BinaryUtils.readUInt32BE(buffer, 0)).toThrow('Buffer too small');
    });
  });

  describe('readUInt32LE', () => {
    it('should read little-endian 32-bit integer', () => {
      const buffer = new Uint8Array([0x0D, 0x00, 0x00, 0x00]); // 13
      const result = BinaryUtils.readUInt32LE(buffer, 0);
      expect(result).toBe(13);
    });

    it('should read large little-endian integer', () => {
      const buffer = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
      const result = BinaryUtils.readUInt32LE(buffer, 0);
      expect(result).toBe(0x12345678);
    });

    it('should read at offset', () => {
      const buffer = new Uint8Array([0xFF, 0xFF, 0x0A, 0x00, 0x00, 0x00]);
      const result = BinaryUtils.readUInt32LE(buffer, 2);
      expect(result).toBe(10);
    });

    it('should handle maximum value', () => {
      const buffer = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
      const result = BinaryUtils.readUInt32LE(buffer, 0);
      expect(result).toBe(0xFFFFFFFF);
    });

    it('should throw error if buffer too small', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00]);
      expect(() => BinaryUtils.readUInt32LE(buffer, 0)).toThrow('Buffer too small');
    });
  });

  describe('crc32', () => {
    it('should calculate CRC32 for empty data', () => {
      const data = new Uint8Array([]);
      const result = BinaryUtils.crc32(data);
      expect(result).toBe(0);
    });

    it('should calculate CRC32 for simple data', () => {
      const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const result = BinaryUtils.crc32(data);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should calculate different CRC32 for different data', () => {
      const data1 = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const data2 = new Uint8Array([0x04, 0x03, 0x02, 0x01]);
      const crc1 = BinaryUtils.crc32(data1);
      const crc2 = BinaryUtils.crc32(data2);
      expect(crc1).not.toBe(crc2);
    });

    it('should calculate same CRC32 for same data', () => {
      const data1 = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const data2 = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      const crc1 = BinaryUtils.crc32(data1);
      const crc2 = BinaryUtils.crc32(data2);
      expect(crc1).toBe(crc2);
    });

    it('should handle known CRC32 value', () => {
      // "123456789" has known CRC32: 0xCBF43926
      const data = new Uint8Array([0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39]);
      const result = BinaryUtils.crc32(data);
      expect(result).toBe(0xCBF43926);
    });
  });

  describe('slice', () => {
    it('should slice buffer', () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4, 5]);
      const result = BinaryUtils.slice(buffer, 2, 5);
      expect(result).toEqual(new Uint8Array([2, 3, 4]));
    });

    it('should slice entire buffer', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      const result = BinaryUtils.slice(buffer, 0, 4);
      expect(result).toEqual(buffer);
    });

    it('should slice empty range', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      const result = BinaryUtils.slice(buffer, 2, 2);
      expect(result).toEqual(new Uint8Array([]));
    });

    it('should throw error for negative start', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      expect(() => BinaryUtils.slice(buffer, -1, 2)).toThrow('Invalid slice start');
    });

    it('should throw error for end beyond buffer', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      expect(() => BinaryUtils.slice(buffer, 0, 10)).toThrow('Invalid slice end');
    });

    it('should throw error for start > end', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      expect(() => BinaryUtils.slice(buffer, 3, 1)).toThrow('Invalid slice range');
    });
  });

  describe('readNullTerminatedString', () => {
    it('should read null-terminated string', () => {
      const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0xFF]); // "Hello\0"
      const result = BinaryUtils.readNullTerminatedString(buffer, 0, 100);
      expect(result).toBe('Hello');
    });

    it('should read string without null terminator', () => {
      const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const result = BinaryUtils.readNullTerminatedString(buffer, 0, 5);
      expect(result).toBe('Hello');
    });

    it('should respect maxLength', () => {
      const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00]); // "Hello\0"
      const result = BinaryUtils.readNullTerminatedString(buffer, 0, 3);
      expect(result).toBe('Hel');
    });

    it('should read from offset', () => {
      const buffer = new Uint8Array([0xFF, 0xFF, 0x48, 0x69, 0x00]); // "Hi" at offset 2
      const result = BinaryUtils.readNullTerminatedString(buffer, 2, 10);
      expect(result).toBe('Hi');
    });

    it('should handle empty string', () => {
      const buffer = new Uint8Array([0x00, 0x48, 0x69]); // "\0Hi"
      const result = BinaryUtils.readNullTerminatedString(buffer, 0, 10);
      expect(result).toBe('');
    });
  });

  describe('readString', () => {
    it('should read fixed-length string', () => {
      const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const result = BinaryUtils.readString(buffer, 0, 5);
      expect(result).toBe('Hello');
    });

    it('should read string at offset', () => {
      const buffer = new Uint8Array([0xFF, 0xFF, 0x48, 0x69]); // "Hi" at offset 2
      const result = BinaryUtils.readString(buffer, 2, 2);
      expect(result).toBe('Hi');
    });

    it('should handle UTF-8 characters', () => {
      const buffer = new Uint8Array([0xE3, 0x81, 0x82]); // "あ" in UTF-8
      const result = BinaryUtils.readString(buffer, 0, 3);
      expect(result).toBe('あ');
    });

    it('should throw error if buffer too small', () => {
      const buffer = new Uint8Array([0x48, 0x65]);
      expect(() => BinaryUtils.readString(buffer, 0, 5)).toThrow('Buffer too small');
    });

    it('should throw error if offset + length exceeds buffer', () => {
      const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      expect(() => BinaryUtils.readString(buffer, 3, 5)).toThrow('Buffer too small');
    });
  });

  describe('hasMagicBytes', () => {
    it('should detect PNG magic bytes', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const result = BinaryUtils.hasMagicBytes(buffer, [0x89, 0x50, 0x4E, 0x47]);
      expect(result).toBe(true);
    });

    it('should detect WebP magic bytes', () => {
      const buffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      const result = BinaryUtils.hasMagicBytes(buffer, [0x52, 0x49, 0x46, 0x46]);
      expect(result).toBe(true);
    });

    it('should return false for non-matching magic bytes', () => {
      const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const result = BinaryUtils.hasMagicBytes(buffer, [0x89, 0x50, 0x4E, 0x47]);
      expect(result).toBe(false);
    });

    it('should return false if buffer too small', () => {
      const buffer = new Uint8Array([0x89, 0x50]);
      const result = BinaryUtils.hasMagicBytes(buffer, [0x89, 0x50, 0x4E, 0x47]);
      expect(result).toBe(false);
    });

    it('should handle empty magic bytes', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const result = BinaryUtils.hasMagicBytes(buffer, []);
      expect(result).toBe(true);
    });

    it('should handle empty buffer', () => {
      const buffer = new Uint8Array([]);
      const result = BinaryUtils.hasMagicBytes(buffer, [0x89]);
      expect(result).toBe(false);
    });
  });
});
