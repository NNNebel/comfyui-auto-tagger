import { describe, it, expect, beforeEach } from 'vitest';

// Import IIFE module - it exports via module.exports for Node.js
const MetadataExtractionReporter = require('../../../js/metadata-parser/reporter/MetadataExtractionReporter.js');

describe('MetadataExtractionReporter', () => {
  let reporter;

  beforeEach(() => {
    reporter = new MetadataExtractionReporter();
  });

  describe('startTrace', () => {
    it('should start a new trace', () => {
      reporter.startTrace('5');
      expect(reporter.currentTrace).toBeDefined();
      expect(reporter.currentTrace.samplerId).toBe('5');
      expect(reporter.currentTrace.startTime).toBeDefined();
      expect(reporter.currentTrace.success).toBe(false);
    });
  });

  describe('logNodeVisit', () => {
    it('should log node visit', () => {
      reporter.startTrace('5');
      reporter.logNodeVisit('3', 'RandomNoise', 'trace_seed');
      
      expect(reporter.currentTrace.visitedNodes).toHaveLength(1);
      expect(reporter.currentTrace.visitedNodes[0]).toMatchObject({
        nodeId: '3',
        nodeType: 'RandomNoise',
        action: 'trace_seed'
      });
    });

    it('should not log if no trace is active', () => {
      reporter.logNodeVisit('3', 'RandomNoise', 'trace_seed');
      expect(reporter.currentTrace).toBeNull();
    });
  });

  describe('logNodeExclusion', () => {
    it('should log node exclusion during trace', () => {
      reporter.startTrace('5');
      reporter.logNodeExclusion('7', 'KSampler', 'no_latent_input');
      
      expect(reporter.currentTrace.excludedNodes).toHaveLength(1);
      expect(reporter.currentTrace.excludedNodes[0]).toMatchObject({
        nodeId: '7',
        nodeType: 'KSampler',
        reason: 'no_latent_input'
      });
    });

    it('should log node exclusion without active trace', () => {
      reporter.logNodeExclusion('7', 'KSampler', 'muted');
      
      expect(reporter.excludedNodesWithoutTrace).toBeDefined();
      expect(reporter.excludedNodesWithoutTrace).toHaveLength(1);
      expect(reporter.excludedNodesWithoutTrace[0]).toMatchObject({
        nodeId: '7',
        nodeType: 'KSampler',
        reason: 'muted'
      });
    });
  });

  describe('logDictionaryUsage', () => {
    it('should log dictionary usage', () => {
      reporter.startTrace('5');
      const definition = { type: 'provider', value_path: ['inputs', 'seed'] };
      reporter.logDictionaryUsage('3', definition);
      
      expect(reporter.currentTrace.dictionaryUsage).toHaveLength(1);
      expect(reporter.currentTrace.dictionaryUsage[0]).toMatchObject({
        nodeId: '3',
        definition
      });
    });
  });

  describe('logHeuristicUsage', () => {
    it('should log heuristic usage', () => {
      reporter.startTrace('5');
      reporter.logHeuristicUsage('3', ['seed', 'noise_seed']);
      
      expect(reporter.currentTrace.heuristicUsage).toHaveLength(1);
      expect(reporter.currentTrace.heuristicUsage[0]).toMatchObject({
        nodeId: '3',
        pattern: ['seed', 'noise_seed']
      });
    });
  });

  describe('endTrace', () => {
    it('should end trace successfully', () => {
      reporter.startTrace('5');
      const metadata = { seed: 123, steps: 20 };
      reporter.endTrace(true, metadata);
      
      expect(reporter.currentTrace).toBeNull();
      expect(reporter.traces).toHaveLength(1);
      expect(reporter.traces[0]).toMatchObject({
        samplerId: '5',
        success: true,
        extractedMetadata: metadata
      });
      expect(reporter.traces[0].endTime).toBeDefined();
    });

    it('should end trace with failure', () => {
      reporter.startTrace('5');
      reporter.endTrace(false, null);
      
      expect(reporter.traces).toHaveLength(1);
      expect(reporter.traces[0].success).toBe(false);
      expect(reporter.traces[0].extractedMetadata).toBeNull();
    });
  });

  describe('getExcludedNodes', () => {
    it('should return excluded nodes from all traces', () => {
      reporter.startTrace('5');
      reporter.logNodeExclusion('7', 'KSampler', 'no_latent_input');
      reporter.endTrace(true, {});
      
      reporter.startTrace('8');
      reporter.logNodeExclusion('9', 'KSampler', 'muted');
      reporter.endTrace(true, {});
      
      const excluded = reporter.getExcludedNodes();
      expect(excluded).toHaveLength(2);
    });

    it('should include excluded nodes without trace', () => {
      reporter.logNodeExclusion('7', 'KSampler', 'bypassed');
      
      const excluded = reporter.getExcludedNodes();
      expect(excluded).toHaveLength(1);
      expect(excluded[0].nodeId).toBe('7');
    });
  });

  describe('getSoftWarningMessage', () => {
    it('should generate soft warning message', () => {
      reporter.logNodeExclusion('7', 'KSampler', 'no_latent_input');
      reporter.logNodeExclusion('8', 'KSampler', 'muted');
      
      const message = reporter.getSoftWarningMessage();
      expect(message).toContain('2個のノード');
      expect(message).toContain('スキップ');
    });
  });

  describe('getHardWarningMessage', () => {
    it('should generate hard warning message', () => {
      reporter.logNodeExclusion('7', 'KSampler', 'no_latent_input');
      
      const message = reporter.getHardWarningMessage();
      expect(message).toContain('抽出に失敗');
      expect(message).toContain('1個のノード');
    });
  });

  describe('generateReport', () => {
    it('should generate error report', () => {
      reporter.startTrace('5');
      reporter.logNodeVisit('3', 'RandomNoise', 'trace_seed');
      reporter.logNodeExclusion('7', 'KSampler', 'no_latent_input');
      reporter.endTrace(false, null);
      
      const workflowJSON = { '5': { class_type: 'SamplerCustomAdvanced' } };
      const report = reporter.generateReport(workflowJSON);
      
      expect(report).toContain('メタデータ抽出エラー報告');
      expect(report).toContain('除外されたノード');
      expect(report).toContain('トレースログ');
      expect(report).toContain('ワークフローJSON');
    });
  });

  describe('clear', () => {
    it('should clear all traces and excluded nodes', () => {
      reporter.startTrace('5');
      reporter.logNodeExclusion('7', 'KSampler', 'muted');
      reporter.endTrace(true, {});
      
      reporter.clear();
      
      expect(reporter.currentTrace).toBeNull();
      expect(reporter.traces).toEqual([]);
      expect(reporter.excludedNodesWithoutTrace).toEqual([]);
    });
  });
});
