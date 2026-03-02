/**
 * MetadataExtractionReporter - Manages trace logs and error reporting
 * 
 * This class tracks the metadata extraction process, logging node visits,
 * exclusions, dictionary usage, and heuristic searches. It generates
 * detailed error reports for debugging and user reporting.
 */

(function() {
  'use strict';

  class MetadataExtractionReporter {
    constructor() {
      this.currentTrace = null;
      this.traces = [];
    }

    /**
     * Start a new trace for a sampler node
     * @param {string} samplerId - The ID of the sampler node
     */
    startTrace(samplerId) {
      this.currentTrace = {
        samplerId,
        startTime: new Date().toISOString(),
        endTime: null,
        success: false,
        visitedNodes: [],
        excludedNodes: [],
        dictionaryUsage: [],
        heuristicUsage: [],
        extractedMetadata: null
      };
    }

    /**
     * Log a node visit during traversal
     * @param {string} nodeId - The ID of the visited node
     * @param {string} nodeType - The class_type of the node
     * @param {string} action - The action being performed (e.g., 'trace_seed', 'start')
     */
    logNodeVisit(nodeId, nodeType, action) {
      if (!this.currentTrace) return;

      this.currentTrace.visitedNodes.push({
        nodeId,
        nodeType,
        action,
        timestamp: new Date().toISOString()
      });
    }

    /**
     * Log a node exclusion (Silent_Drop)
     * @param {string} nodeId - The ID of the excluded node
     * @param {string} nodeType - The class_type of the node
     * @param {string} reason - The reason for exclusion
     */
    logNodeExclusion(nodeId, nodeType, reason) {
      if (!this.currentTrace) {
        // If no trace is active, store in a separate list
        if (!this.excludedNodesWithoutTrace) {
          this.excludedNodesWithoutTrace = [];
        }
        this.excludedNodesWithoutTrace.push({
          nodeId,
          nodeType,
          reason,
          timestamp: new Date().toISOString()
        });
        return;
      }

      this.currentTrace.excludedNodes.push({
        nodeId,
        nodeType,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    /**
     * Log dictionary definition usage
     * @param {string} nodeId - The ID of the node
     * @param {Object} definition - The dictionary definition used
     */
    logDictionaryUsage(nodeId, definition) {
      if (!this.currentTrace) return;

      this.currentTrace.dictionaryUsage.push({
        nodeId,
        definition,
        timestamp: new Date().toISOString()
      });
    }

    /**
     * Log heuristic search usage
     * @param {string} nodeId - The ID of the node
     * @param {Array|string} pattern - The pattern(s) used for heuristic search
     */
    logHeuristicUsage(nodeId, pattern) {
      if (!this.currentTrace) return;

      this.currentTrace.heuristicUsage.push({
        nodeId,
        pattern,
        timestamp: new Date().toISOString()
      });
    }

    /**
     * End the current trace
     * @param {boolean} success - Whether the extraction was successful
     * @param {Object} metadata - The extracted metadata
     */
    endTrace(success, metadata) {
      if (!this.currentTrace) return;

      this.currentTrace.endTime = new Date().toISOString();
      this.currentTrace.success = success;
      this.currentTrace.extractedMetadata = metadata;

      this.traces.push(this.currentTrace);
      this.currentTrace = null;
    }

    /**
     * Get all excluded nodes (from all traces and without trace)
     * @returns {Array} List of excluded nodes
     */
    getExcludedNodes() {
      const excluded = [];

      // Add excluded nodes from all traces
      for (const trace of this.traces) {
        excluded.push(...trace.excludedNodes);
      }

      // Add excluded nodes without trace
      if (this.excludedNodesWithoutTrace) {
        excluded.push(...this.excludedNodesWithoutTrace);
      }

      return excluded;
    }

    /**
     * Generate a soft warning message
     * @returns {string} The warning message
     */
    getSoftWarningMessage() {
      const excludedCount = this.getExcludedNodes().length;
      return `メタデータの抽出中に${excludedCount}個のノードがスキップされました。`;
    }

    /**
     * Generate a hard warning message
     * @returns {string} The warning message
     */
    getHardWarningMessage() {
      const excludedCount = this.getExcludedNodes().length;
      return `メタデータの抽出に失敗しました\n\n${excludedCount}個のノードがスキップされ、有効なサンプラーが見つかりませんでした。\nこのワークフローは非標準のカスタムノードを使用している可能性があります。`;
    }

    /**
     * Generate a detailed error report
     * @param {Object} workflowJSON - The ComfyUI workflow JSON
     * @returns {string} The formatted error report
     */
    generateReport(workflowJSON) {
      const excludedNodes = this.getExcludedNodes();
      
      let report = '## メタデータ抽出エラー報告\n\n';
      
      // Environment info
      report += '### 環境情報\n';
      report += `- 日時: ${new Date().toISOString()}\n`;
      report += `- 除外ノード数: ${excludedNodes.length}\n`;
      report += `- トレース数: ${this.traces.length}\n\n`;
      
      // Excluded nodes
      if (excludedNodes.length > 0) {
        report += '### 除外されたノード\n';
        excludedNodes.forEach((node, index) => {
          report += `${index + 1}. ノードID: ${node.nodeId}, タイプ: ${node.nodeType}, 理由: ${node.reason}\n`;
        });
        report += '\n';
      }
      
      // Trace logs
      report += '### トレースログ\n';
      report += '```json\n';
      report += JSON.stringify(this.traces, null, 2);
      report += '\n```\n\n';
      
      // Workflow JSON
      if (workflowJSON) {
        report += '### ワークフローJSON\n';
        report += '```json\n';
        report += JSON.stringify(workflowJSON, null, 2);
        report += '\n```\n\n';
      }
      
      report += '### 次のステップ\n';
      report += '元の画像ファイルをこのIssueに添付してください。\n';
      
      return report;
    }

    /**
     * Copy the error report to clipboard
     * @param {Object} workflowJSON - The ComfyUI workflow JSON
     * @returns {Promise<boolean>} True if successful
     */
    async copyToClipboard(workflowJSON) {
      try {
        const report = this.generateReport(workflowJSON);
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(report);
          return true;
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = report;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textarea);
          return success;
        }
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
      }
    }

    /**
     * Open GitHub issue creation page
     */
    openGitHubIssue() {
      const repoUrl = 'https://github.com/YOUR_USERNAME/YOUR_REPO/issues/new';
      const title = encodeURIComponent('メタデータ抽出エラー');
      const body = encodeURIComponent('エラー報告をここに貼り付けてください。\n\n元の画像ファイルも添付してください。');
      
      window.open(`${repoUrl}?title=${title}&body=${body}`, '_blank');
    }

    /**
     * Clear all traces and excluded nodes
     */
    clear() {
      this.currentTrace = null;
      this.traces = [];
      this.excludedNodesWithoutTrace = [];
    }
  }

  // Export for browser environment
  if (typeof window !== 'undefined') {
    window.MetadataExtractionReporter = MetadataExtractionReporter;
  }

  // Export for Node.js environment (testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetadataExtractionReporter;
  }
})();
