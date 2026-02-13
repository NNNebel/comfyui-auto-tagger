# Changelog

All notable changes to this project will be documented in this file.

## [1.3.3] - 2026-02-13

### 🇬🇧 English
#### 🎉 New Features
- **Suspicious Node Detection with UI Integration**:
  - Implemented heuristic detection to identify nodes with missing required inputs in ComfyUI workflows.
  - Added user-configurable handling modes: exclude (default), include, or ask via dialog.
  - Dialog displays affected generation steps for each suspicious node.
  - Shift+Click functionality to apply decisions to all remaining images.
  - Settings persistence via localStorage.

#### 🐛 Bug Fixes
- Fixed base sampler detection in ComfyUI workflows with DetailerForEach nodes
- Improved distance calculation for samplers that work on images rather than latents
- Fixed sampler execution order in generationSteps by restoring DFS (Depth-First Search) algorithm

#### ✨ Improvements
- Enhanced workflow validation to detect non-executable nodes before processing.
- Improved user feedback with visual indicators for suspicious nodes.
- Better handling of complex workflows with multiple refinement stages.
- Optimized metadata parsing engine for better performance and reliability
- Improved error handling with more informative error messages
- Enhanced code maintainability and extensibility

#### 🔧 Internal Refactoring
- Refactored internal parsing architecture for improved code quality
- Optimized parsing algorithms for faster metadata extraction
- Improved code organization and reduced duplication
- Restored DFS-based sampler discovery to maintain correct execution order

#### 🧪 Testing
- Added comprehensive unit tests for suspicious node detection logic.
- Added integration tests for suspicious node workflows.
- Fixed test assertions to match actual translation key format.
- Added comprehensive integration tests for all fixture images
- Enhanced test validation to verify sampler execution order
- Renamed tests/samples to tests/fixtures for better clarity
- All tests passing (760/760).

### 🇯🇵 日本語
#### 🎉 新機能
- **疑わしいノード検出とUI統合**:
  - ComfyUIワークフロー内で必須入力が不足しているノードを検出するヒューリスティック検出を実装しました。
  - ユーザー設定可能な処理モード: 除外（デフォルト）、含める、またはダイアログで確認。
  - 各疑わしいノードに影響を受ける生成ステップをダイアログに表示します。
  - Shift+クリック機能で、残りの全ての画像に決定を適用できます。
  - localStorageを使用した設定の永続化。

#### 🐛 バグ修正
- DetailerForEachノードを含むComfyUIワークフローでのbase sampler検出を修正
- latentではなく画像を処理するサンプラーの距離計算を改善
- DFS（深さ優先探索）アルゴリズムを復元し、generationStepsのサンプラー実行順序を修正

#### ✨ 改善
- ワークフロー検証を強化し、処理前に実行不可能なノードを検出します。
- 疑わしいノードの視覚的インジケータでユーザーフィードバックを改善しました。
- 複数の改善ステージを持つ複雑なワークフローの処理を改善しました。
- メタデータパースエンジンを最適化し、パフォーマンスと信頼性を向上
- エラーハンドリングを改善し、より詳細なエラーメッセージを提供
- コードの保守性と拡張性を向上

#### 🔧 内部リファクタリング
- 内部パースアーキテクチャをリファクタリングしてコード品質を向上
- パースアルゴリズムを最適化してメタデータ抽出を高速化
- コード構成を改善し、重複を削減
- 正しい実行順序を維持するため、DFSベースのサンプラー発見を復元

#### 🧪 テスト
- 疑わしいノード検出ロジックの包括的なユニットテストを追加しました。
- 疑わしいノードワークフローの統合テストを追加しました。
- テストアサーションを実際の翻訳キー形式に合わせて修正しました。
- 全てのフィクスチャ画像に対する包括的な統合テストを追加
- サンプラー実行順序を検証するテストを強化
- tests/samplesをtests/fixturesに名称変更し、明確化
- 全テスト成功（760/760）。

## [1.3.2] - 2026-01-30

### 🇬🇧 English
#### 🎉 New Features
- **Stable Diffusion WebUI (A1111) Support**:
  - Added official support for Automatic1111, Forge, and other A1111-based WebUI generated images.
  - Extracts prompts, negative prompts, seed, steps, CFG scale, sampler, model, and other parameters.
  - Works with both PNG and WebP formats.
- **Civitai Generated Images Support**:
  - Full support for images generated on Civitai platform.
  - Automatically detects and extracts generation parameters.
- **Force Delete Mode**:
  - Added "Force Delete Mode" (Shift + Click on "Delete Info") to remove all tags from selected images without metadata analysis.
  - Useful for cleaning up malformed tags.

#### ✨ Improvements
- **Enhanced Multi-Sampler Workflow Support (ComfyUI)**:
  - Implemented VAEEncode image chain tracing for accurate base sampler detection in img2img workflows.
  - Improved distance calculation for samplers in complex workflows (HiresFix, FaceDetailer, etc.).
  - Special handling for DetailerForEach and other nodes without `latent_image` input.
  - More accurate base sampler selection in workflows with multiple refinement stages.
- **Enhanced LoRA Extraction**:
  - Improved detection to handle both standard LoraLoader nodes and custom extensions (e.g., "Lora Loader Stack (rgthree)").
  - Detects LoRA files from any node with "lora" in input keys.
  - Added support for extracting LoRA information from A1111 images (both from "Lora hashes" parameter and prompt tags).

#### 🐛 Bug Fixes
- Fixed ComfyUI annotation generation to skip "[Generation Info]" label when no samplers are found.
- Fixed ComfyUI annotation to skip step labels when no content is available for that step (e.g., when only LoRA is enabled).

#### 🔧 Internal Refactoring
- **Metadata Parser Architecture Refactoring**:
  - Migrated to a three-layer architecture (Binary Extraction → Format Detection → Parsing) for better maintainability and extensibility.
  - Introduced `MetadataService` as the main entry point for metadata extraction.
  - Separated format-specific logic into dedicated parser classes (`ComfyUIParser`, `A1111Parser`).
  - Removed duplicate code from `core.js` and delegated parsing to the new architecture.

#### 🧪 Testing
- Added comprehensive test suite with 200+ tests covering unit tests, integration tests, and property-based tests.
- Improved test suite to separate sample data (fictional) from actual test expectations (real data), ensuring safer and more robust testing.

### 🇯🇵 日本語
#### 🎉 新機能
- **Stable Diffusion WebUI (A1111) 対応**:
  - Automatic1111、Forge、その他A1111ベースのWebUIで生成された画像に正式対応しました。
  - プロンプト、ネガティブプロンプト、Seed値、Steps、CFG scale、サンプラー、モデルなどのパラメータを抽出します。
  - PNGとWebPの両フォーマットに対応しています。
- **Civitai生成画像対応**:
  - Civitaiプラットフォームで生成された画像に完全対応しました。
  - 生成パラメータを自動検出・抽出します。
- **強制削除モード**:
  - 「情報を削除」ボタンをShiftキーを押しながらクリックすると、メタデータ解析を行わずに選択画像の全てのタグを削除する「強制削除モード」を追加しました。
  - 不正なタグを一括削除する際に便利です。

#### ✨ 改善
- **マルチサンプラーワークフローのサポート強化（ComfyUI）**:
  - img2imgワークフローでの正確なベースサンプラー検出のため、VAEEncodeの画像チェーン追跡を実装しました。
  - 複雑なワークフロー（HiresFix、FaceDetailerなど）でのサンプラー距離計算を改善しました。
  - DetailerForEachなど`latent_image`入力を持たないノードの特別処理を追加しました。
  - 複数のリファインメント段階を持つワークフローでのベースサンプラー選択がより正確になりました。
- **LoRA抽出の強化**:
  - 標準的な LoraLoader ノードとカスタム拡張（例："Lora Loader Stack (rgthree)"）の両方に対応し、検出精度を改善しました。
  - "lora" を含む任意のノードの入力キーから LoRA ファイルを検出できるようになりました。
  - A1111 画像からの LoRA 情報抽出に対応しました（"Lora hashes" パラメータとプロンプトタグの両方から抽出）。

#### 🐛 バグ修正
- ComfyUI のアノテーション生成で、サンプラーが見つからない場合に "[Generation Info]" ラベルだけが表示される問題を修正しました。
- ComfyUI のアノテーション生成で、ステップにコンテンツがない場合（例：LoRA のみ有効な場合）にステップラベルを表示しないように修正しました。

#### 🔧 内部リファクタリング
- **メタデータパーサーのアーキテクチャ刷新**:
  - 保守性と拡張性を向上させるため、3層アーキテクチャ（バイナリ抽出 → フォーマット検出 → パース）に移行しました。
  - メタデータ抽出のメインエントリーポイントとして`MetadataService`を導入しました。
  - フォーマット固有のロジックを専用のパーサークラス（`ComfyUIParser`、`A1111Parser`）に分離しました。
  - `core.js`から重複コードを削除し、新しいアーキテクチャにパース処理を委譲しました。

#### 🧪 テスト
- 200以上のテストを含む包括的なテストスイート（ユニットテスト、統合テスト、プロパティテスト）を追加しました。
- テスト環境を整備し、公開用サンプルデータ（架空）とテスト実行用データ（実データ）を分離することで、安全性と信頼性を向上させました。

## [1.3.1] - 2026-01-10

### 🇬🇧 English
- Fixed an issue where some labels were not translated when English was selected.
- Fixed a bug where checkpoint names were extracted as file paths (e.g., `epsilon\model`) instead of just the filename.

### 🇯🇵 日本語
- 英語表示時に一部表記が翻訳されない問題を修正。
- チェックポイント名がファイルパス（例：`epsilon\model`）として抽出されてしまうバグを修正。


## [1.3.0] - 2024-12-28

### 🇬🇧 English
#### ✨ New Features & Improvements
- **More Accurate Metadata Extraction**:
  - Added support for extracting data from prompt (API format) in addition to the standard ComfyUI workflow. This significantly improves the accuracy of extracting parameters (Seed, Steps, Prompts, etc.), especially in complex workflows.
  - Now recursively resolves values passed through Reroute nodes or Primitive nodes to ensure correct parameter retrieval.
- **Write to Notes (Annotation)**:
  - Extracted generation info can now be formatted and written to the image's Note section, not just Tags.
  - **Smart updating**: Preserves existing user notes while overwriting only the information block generated by this plugin on subsequent runs.
- **UI/UX Improvements**:
  - Implemented chunk processing to prevent the app from freezing during batch operations.
  - Added a progress bar to visualize the processing status.
  - Fixed the Cancel button to work correctly for both tagging and deletion processes.
  - Adjusted the UI layout to ensure all options are properly visible.
- **Debug Functionality**:
  - Added a Debug Mode toggle in the UI. When enabled, detailed logs are output to the console and a temporary log file for easier troubleshooting.

#### 🐛 Bug Fixes
- **WebP Support**: Fixed parsing logic to correctly handle ComfyUI metadata within WebP images.
- **Stabilized Multi-language Support**: Fixed to correctly utilize Eagle's built-in i18next. The UI and logs are now reliably translated based on the environment (English/Japanese).
- **Dark Mode Support**: Fixed an issue where the plugin UI did not follow Eagle's theme settings (Light/Dark).
- Other minor bug fixes and performance improvements.

### 🇯🇵 日本語
#### ✨ 主な新機能・機能改善
- **より正確なメタデータ抽出**:
  - ComfyUIの workflow に加え、prompt（API format）からのデータ抽出に対応しました。これにより、特に複雑なワークフローでのパラメータ（Seed, Steps, プロンプトなど）の抽出精度が大幅に向上しました。
  - Reroute ノードや Primitive ノードを経由した値も再帰的に解決し、正確なパラメータを取得できるようになりました。
- **メモ（Annotation）への書き込み機能**:
  - 抽出した生成情報を、タグだけでなく画像のメモ欄にも整形して書き込めるようになりました。
  - **スマート更新機能**：2回目以降の実行でも、既存のユーザーメモを保持しつつ、プラグインが生成した情報ブロックだけを新しい内容で上書きします。
- **UI/UXの改善**:
  - 処理中にフリーズしないよう、チャンク処理を導入しました。
  - 処理の進捗がわかるプログレスバーを追加しました。
  - キャンセルボタンがタグ付け・削除の両方で正しく機能するようになりました。
  - UIのレイアウトを調整し、全てのオプションが表示されるようにしました。
- **デバッグ機能の追加**:
  - UIからデバッグモードを有効化できるようになりました。有効にすると、詳細なログがコンソールと一時フォルダ内のログファイルに出力されます。

#### 🐛 不具合修正
- **WebPファイルのサポート**: WebP形式の画像に含まれるComfyUIメタデータの解析に対応しました。
- **多言語対応の安定化**: Eagleに組み込まれている i18next を正しく利用するように修正し、UIとログが日本語・英語環境で確実に翻訳されるようになりました。
- **ダークモード対応**: プラグインのUIがEagleのテーマ（ライト/ダーク）に追従しなかった問題を修正しました。
- その他、多数の軽微なバグ修正とパフォーマンス改善を行いました。
