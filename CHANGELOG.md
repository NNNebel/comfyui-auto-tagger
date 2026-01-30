# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🇬🇧 English
#### 🐛 Bug Fixes
- Fixed ComfyUI parser to support advanced sampler nodes (SamplerCustomAdvanced, Flux models) that don't have direct seed/steps/cfg inputs.
- Improved parameter extraction for advanced samplers by tracing through connected nodes (RandomNoise, BasicScheduler, FluxGuidance).
- Fixed prompt extraction for advanced samplers by tracing through guider and conditioning nodes.

#### ✨ Improvements
- Enhanced ComfyUI parser to handle Flux model workflows with complex node structures.
- Improved parameter resolution to support both traditional KSampler and modern advanced sampler architectures.

#### 🧪 Testing
- Added test data for Flux model ComfyUI images (comfyui_flux.json) to validate advanced sampler support.
- Updated integration tests to handle format-specific metadata structures (ComfyUI vs A1111).

### 🇯🇵 日本語
#### 🐛 バグ修正
- ComfyUIパーサーがSamplerCustomAdvancedやFluxモデルなどの高度なサンプラーノードに対応しました。
- 接続されたノード（RandomNoise、BasicScheduler、FluxGuidance）を辿ることでパラメータ抽出を改善しました。
- 高度なサンプラーのプロンプト抽出をguiderとconditioning ノードを辿ることで改善しました。

#### ✨ 改善
- ComfyUIパーサーがFluxモデルの複雑なノード構造に対応しました。
- 従来のKSamplerと最新の高度なサンプラーアーキテクチャの両方をサポートするようにパラメータ解決を改善しました。

#### 🧪 テスト
- Fluxモデルの ComfyUI 画像用テストデータ（comfyui_flux.json）を追加して、高度なサンプラーサポートを検証しました。
- 統合テストをフォーマット固有のメタデータ構造（ComfyUI vs A1111）に対応するように更新しました。

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
