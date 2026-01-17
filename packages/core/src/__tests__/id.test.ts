/**
 * Tests for ID generation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  ID_PREFIXES,
  generateId,
  generateTenantId,
  generateUserId,
  generateGroupId,
  generateTaskId,
  generateWorkflowId,
  generateConversationId,
  generateMessageId,
  generateApiKey,
  generateSessionId,
  generateRequestId,
  generateRawId,
  parseId,
  isValidId,
  isTenantId,
  isUserId,
  isGroupId,
  isTaskId,
  isWorkflowId,
  isConversationId,
  isMessageId,
} from '../utils/id.js';

describe('ID Generation', () => {
  describe('generateId', () => {
    it('should generate a prefixed ID', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_[a-zA-Z0-9]+$/);
    });

    it('should generate IDs of correct length', () => {
      const id = generateId('test');
      // prefix (4) + underscore (1) + nanoid (21) = 26
      expect(id.length).toBe(26);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId('test'));
      }
      expect(ids.size).toBe(1000);
    });

    it('should support custom length', () => {
      const id = generateId('test', 10);
      // prefix (4) + underscore (1) + custom length (10) = 15
      expect(id.length).toBe(15);
    });
  });

  describe('Entity ID generators', () => {
    it('should generate tenant ID with correct prefix', () => {
      const id = generateTenantId();
      expect(id).toMatch(/^ten_[a-zA-Z0-9]+$/);
      expect(isTenantId(id)).toBe(true);
    });

    it('should generate user ID with correct prefix', () => {
      const id = generateUserId();
      expect(id).toMatch(/^usr_[a-zA-Z0-9]+$/);
      expect(isUserId(id)).toBe(true);
    });

    it('should generate group ID with correct prefix', () => {
      const id = generateGroupId();
      expect(id).toMatch(/^grp_[a-zA-Z0-9]+$/);
      expect(isGroupId(id)).toBe(true);
    });

    it('should generate task ID with correct prefix', () => {
      const id = generateTaskId();
      expect(id).toMatch(/^tsk_[a-zA-Z0-9]+$/);
      expect(isTaskId(id)).toBe(true);
    });

    it('should generate workflow ID with correct prefix', () => {
      const id = generateWorkflowId();
      expect(id).toMatch(/^wfl_[a-zA-Z0-9]+$/);
      expect(isWorkflowId(id)).toBe(true);
    });

    it('should generate conversation ID with correct prefix', () => {
      const id = generateConversationId();
      expect(id).toMatch(/^cnv_[a-zA-Z0-9]+$/);
      expect(isConversationId(id)).toBe(true);
    });

    it('should generate message ID with correct prefix', () => {
      const id = generateMessageId();
      expect(id).toMatch(/^msg_[a-zA-Z0-9]+$/);
      expect(isMessageId(id)).toBe(true);
    });

    it('should generate API key with longer length', () => {
      const key = generateApiKey();
      expect(key).toMatch(/^key_[a-zA-Z0-9]+$/);
      // prefix (3) + underscore (1) + length (32) = 36
      expect(key.length).toBe(36);
    });

    it('should generate session ID with correct prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^ses_[a-zA-Z0-9]+$/);
    });

    it('should generate request ID with correct prefix', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^req_[a-zA-Z0-9]+$/);
    });
  });

  describe('generateRawId', () => {
    it('should generate raw ID without prefix', () => {
      const id = generateRawId();
      expect(id).toMatch(/^[a-zA-Z0-9]+$/);
      expect(id).not.toContain('_');
    });

    it('should generate ID of default length', () => {
      const id = generateRawId();
      expect(id.length).toBe(21);
    });

    it('should support custom length', () => {
      const id = generateRawId(10);
      expect(id.length).toBe(10);
    });
  });

  describe('parseId', () => {
    it('should parse valid prefixed ID', () => {
      const result = parseId('ten_abc123xyz');
      expect(result).toEqual({ prefix: 'ten', value: 'abc123xyz' });
    });

    it('should return null for invalid ID', () => {
      expect(parseId('invalid')).toBeNull();
      expect(parseId('')).toBeNull();
      expect(parseId('_abc')).toBeNull();
      expect(parseId('toolong_abc')).toBeNull();
    });

    it('should return null for ID without underscore', () => {
      expect(parseId('tenabc123')).toBeNull();
    });

    it('should return null for ID with invalid characters', () => {
      expect(parseId('ten_abc-123')).toBeNull();
      expect(parseId('ten_abc.123')).toBeNull();
    });
  });

  describe('isValidId', () => {
    it('should return true for valid ID with matching prefix', () => {
      expect(isValidId('ten_abc123', 'ten')).toBe(true);
      expect(isValidId('usr_xyz789', 'usr')).toBe(true);
    });

    it('should return false for valid ID with wrong prefix', () => {
      expect(isValidId('ten_abc123', 'usr')).toBe(false);
      expect(isValidId('usr_xyz789', 'ten')).toBe(false);
    });

    it('should return false for invalid ID', () => {
      expect(isValidId('invalid', 'ten')).toBe(false);
      expect(isValidId('', 'ten')).toBe(false);
    });
  });

  describe('Type guards', () => {
    it('should correctly identify tenant IDs', () => {
      expect(isTenantId('ten_abc123')).toBe(true);
      expect(isTenantId('usr_abc123')).toBe(false);
    });

    it('should correctly identify user IDs', () => {
      expect(isUserId('usr_abc123')).toBe(true);
      expect(isUserId('ten_abc123')).toBe(false);
    });

    it('should correctly identify group IDs', () => {
      expect(isGroupId('grp_abc123')).toBe(true);
      expect(isGroupId('usr_abc123')).toBe(false);
    });

    it('should correctly identify task IDs', () => {
      expect(isTaskId('tsk_abc123')).toBe(true);
      expect(isTaskId('wfl_abc123')).toBe(false);
    });

    it('should correctly identify workflow IDs', () => {
      expect(isWorkflowId('wfl_abc123')).toBe(true);
      expect(isWorkflowId('tsk_abc123')).toBe(false);
    });

    it('should correctly identify conversation IDs', () => {
      expect(isConversationId('cnv_abc123')).toBe(true);
      expect(isConversationId('msg_abc123')).toBe(false);
    });

    it('should correctly identify message IDs', () => {
      expect(isMessageId('msg_abc123')).toBe(true);
      expect(isMessageId('cnv_abc123')).toBe(false);
    });
  });

  describe('ID_PREFIXES', () => {
    it('should have all expected prefixes', () => {
      expect(ID_PREFIXES.tenant).toBe('ten');
      expect(ID_PREFIXES.user).toBe('usr');
      expect(ID_PREFIXES.group).toBe('grp');
      expect(ID_PREFIXES.task).toBe('tsk');
      expect(ID_PREFIXES.workflow).toBe('wfl');
      expect(ID_PREFIXES.conversation).toBe('cnv');
      expect(ID_PREFIXES.message).toBe('msg');
      expect(ID_PREFIXES.apiKey).toBe('key');
      expect(ID_PREFIXES.session).toBe('ses');
      expect(ID_PREFIXES.request).toBe('req');
    });
  });
});
