# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🇬🇧 English
#### 🐛 Bug Fixes
- Fixed incorrect negative prompt extraction when conditioning passes through an intermediate node (e.g. `ConditioningCombine`) not registered in the dictionary. Previously, BFS traversal could accidentally pick up a positive `CLIPTextEncode`'s text as the negative prompt.
- Fixed `CLIPTextEncode` dictionary entry so it correctly returns its text when reached via either the positive or negative conditioning chain.

#### ✨ Improvements
- Added `CLIPTextEncodeSDXL` to the default node dictionary, enabling correct positive/negative prompt extraction for SDXL workflows (uses `text_g` field).
- Clarified comment on custom LoRA loader input key matching: `.safetensors` extension check already guards against false positives from non-filename keys like `lora_strength`.

### 🇯🇵 日本語
#### 🐛 バグ修正
- `ConditioningCombine` などの中間ノード経由で negative プロンプトを取得する際に、positive 側の `CLIPTextEncode` テキストが誤って negative として取得される不具合を修正。BFS パターンから `text` / `prompt` を negative 用に除外し、辞書登録済みの `CLIPTextEncode` が文脈に応じて正しくテキストを返すよう対応。
- `CLIPTextEncode` の辞書エントリを修正し、positive/negative どちらの経路から到達した場合もテキストを返すよう対応。

#### ✨ 改善
- デフォルト辞書に `CLIPTextEncodeSDXL` を追加。SDXL ワークフローで positive/negative プロンプトが正しく取得できるようになった（`text_g` フィールドを使用）。

---

## [1.3.4] - 2026-03-07

### 🇬🇧 English
#### 🎉 New Features
- **Settings Dialog**: Added a dedicated settings dialog to organize configuration options
  - Processing settings (chunk size, suspicious node handling)
  - Dictionary settings (online fetch toggle)
  - Debug mode toggle
  - GitHub Issue reporting button
- **GitHub Issue Reporting**: Report issues directly from the plugin
  - One-click button to open GitHub issue creation page
  - Automatic error report generation with trace logs
  - Clipboard copy functionality for error details

#### ✨ Improvements
- Improved metadata extraction accuracy with dictionary-based system
- Better support for custom ComfyUI nodes
- Enhanced error reporting with detailed trace logs

#### 🐛 Bug Fixes
- Fixed false positive detection of provider nodes (e.g., `KSamplerSelect`, `BasicScheduler`, `RandomNoise`) as suspicious nodes
  - These nodes provide configuration values to samplers but are not samplers themselves
  - Now uses dictionary-based detection to correctly identify and exclude provider nodes
  - Improved accuracy of suspicious node detection in complex workflows

### 🇯🇵 日本語
#### 🎉 新機能
- **設定ダイアログ**: 設定オプションを整理するための専用設定ダイアログを追加
  - 処理設定（チャンクサイズ、疑わしいノードの処理）
  - 辞書設定（オンライン取得の切り替え）
  - デバッグモードの切り替え
  - GitHub Issue報告ボタン
- **GitHub Issue報告**: プラグインから直接問題を報告
  - ワンクリックでGitHub issue作成ページを開く
  - トレースログ付きの自動エラーレポート生成
  - エラー詳細のクリップボードコピー機能

#### ✨ 改善
- 辞書ベースシステムによるメタデータ抽出精度の向上
- カスタムComfyUIノードのサポート改善
- 詳細なトレースログによるエラー報告の強化

#### 🐛 バグ修正
- providerノード（例：`KSamplerSelect`、`BasicScheduler`、`RandomNoise`）が疑わしいノードとして誤検知される問題を修正
  - これらのノードはサンプラーに設定値を提供するものであり、サンプラー自体ではない
  - 辞書ベースの検出を使用して、providerノードを正しく識別・除外するようになりました
  - 複雑なワークフローでの疑わしいノード検出の精度が向上しました

## [1.3.3] - 2026-02-13

### 🇬🇧 English
#### 🎉 New Features
- **Suspicious Node Detection with UI Integration**:
  - Detects nodes with missing required inputs in ComfyUI workflows
  - User-configurable handling modes: exclude (default), include, or ask via dialog
  - Dialog displays affected generation steps for each suspicious node
  - Shift+Click functionality to apply decisions to all remaining images
  - Settings persistence via localStorage

#### 🐛 Bug Fixes
- Fixed base sampler detection in ComfyUI workflows with DetailerForEach nodes
- Improved distance calculation for samplers that work on images rather than latents

#### ✨ Improvements
- Enhanced workflow validation to detect non-executable nodes before processing
- Improved user feedback with visual indicators for suspicious nodes
- Better handling of complex workflows with multiple refinement stages

### 🇯🇵 日本語
#### 🎉 新機能
- **疑わしいノード検出とUI統合**:
  - ComfyUIワークフロー内で必須入力が不足しているノードを検出
  - ユーザー設定可能な処理モード: 除外（デフォルト）、含める、またはダイアログで確認
  - 各疑わしいノードに影響を受ける生成ステップをダイアログに表示
  - Shift+クリック機能で、残りの全ての画像に決定を適用
  - localStorageを使用した設定の永続化

#### 🐛 バグ修正
- DetailerForEachノードを含むComfyUIワークフローでのbase sampler検出を修正
- latentではなく画像を処理するサンプラーの距離計算を改善

#### ✨ 改善
- ワークフロー検証を強化し、処理前に実行不可能なノードを検出
- 疑わしいノードの視覚的インジケータでユーザーフィードバックを改善
- 複数の改善ステージを持つ複雑なワークフローの処理を改善

## [1.3.2] - 2026-01-30

### 🇬🇧 English
#### 🎉 New Features
- **Stable Diffusion WebUI (A1111) Support**:
  - Added official support for Automatic1111, Forge, and other A1111-based WebUI generated images
  - Extracts prompts, negative prompts, seed, steps, CFG scale, sampler, model, and other parameters
  - Works with both PNG and WebP formats
- **Civitai Generated Images Support**:
  - Full support for images generated on Civitai platform
  - Automatically detects and extracts generation parameters
- **Force Delete Mode**:
  - Added "Force Delete Mode" (Shift + Click on "Delete Info") to remove all tags from selected images without metadata analysis
  - Useful for cleaning up malformed tags

#### ✨ Improvements
- **Enhanced Multi-Sampler Workflow Support (ComfyUI)**:
  - Improved base sampler detection in img2img workflows
  - Better distance calculation for samplers in complex workflows (HiresFix, FaceDetailer, etc.)
  - More accurate base sampler selection in workflows with multiple refinement stages
- **Enhanced LoRA Extraction**:
  - Improved detection to handle both standard LoraLoader nodes and custom extensions (e.g., "Lora Loader Stack (rgthree)")
  - Added support for extracting LoRA information from A1111 images (both from "Lora hashes" parameter and prompt tags)

#### 🐛 Bug Fixes
- Fixed ComfyUI annotation generation to skip "[Generation Info]" label when no samplers are found
- Fixed ComfyUI annotation to skip step labels when no content is available for that step

### 🇯🇵 日本語
#### 🎉 新機能
- **Stable Diffusion WebUI (A1111) 対応**:
  - Automatic1111、Forge、その他A1111ベースのWebUIで生成された画像に正式対応
  - プロンプト、ネガティブプロンプト、Seed値、Steps、CFG scale、サンプラー、モデルなどのパラメータを抽出
  - PNGとWebPの両フォーマットに対応
- **Civitai生成画像対応**:
  - Civitaiプラットフォームで生成された画像に完全対応
  - 生成パラメータを自動検出・抽出
- **強制削除モード**:
  - 「情報を削除」ボタンをShiftキーを押しながらクリックすると、メタデータ解析を行わずに選択画像の全てのタグを削除する「強制削除モード」を追加
  - 不正なタグを一括削除する際に便利

#### ✨ 改善
- **マルチサンプラーワークフローのサポート強化（ComfyUI）**:
  - img2imgワークフローでの正確なベースサンプラー検出を改善
  - 複雑なワークフロー（HiresFix、FaceDetailerなど）でのサンプラー距離計算を改善
  - 複数のリファインメント段階を持つワークフローでのベースサンプラー選択がより正確に
- **LoRA抽出の強化**:
  - 標準的な LoraLoader ノードとカスタム拡張（例："Lora Loader Stack (rgthree)"）の両方に対応
  - A1111 画像からの LoRA 情報抽出に対応（"Lora hashes" パラメータとプロンプトタグの両方から抽出）

#### 🐛 バグ修正
- ComfyUI のアノテーション生成で、サンプラーが見つからない場合に "[Generation Info]" ラベルだけが表示される問題を修正
- ComfyUI のアノテーション生成で、ステップにコンテンツがない場合にステップラベルを表示しないように修正

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
