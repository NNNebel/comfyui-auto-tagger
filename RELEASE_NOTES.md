# Pre-Release v1.3.2-pre

⚠️ **This is a pre-release version for testing purposes.**

## [1.3.2-pre] - 2026-01-27

### 🇬🇧 English
[!IMPORTANT]
### ⚠️ Pre-release Notice (Untested on Eagle App)
This is a **pre-release** version. While I have implemented a comprehensive test suite (200+ tests) covering the new metadata parsers, I currently do not have access to an environment where the Eagle app is installed. Therefore, **the actual behavior within the Eagle interface remains untested.**
If you encounter any issues, please report them on the GitHub Issue. Your feedback is essential to making this a stable release!

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

#### 🔧 Internal Refactoring
- **Metadata Parser Architecture Refactoring**:
  - Migrated to a three-layer architecture (Binary Extraction → Format Detection → Parsing) for better maintainability and extensibility.
  - Introduced `MetadataService` as the main entry point for metadata extraction.
  - Separated format-specific logic into dedicated parser classes (`ComfyUIParser`, `A1111Parser`).
  - Removed duplicate code from `core.js` and delegated parsing to the new architecture.

#### 🧪 Testing
- Added comprehensive test suite with 200+ tests covering:
  - Unit tests for all parser components
  - Integration tests with real sample images (ComfyUI, A1111, Civitai)
  - Property-based tests for robustness
- Added debug scripts for troubleshooting metadata extraction issues.

### 🇯🇵 日本語
[!IMPORTANT]
### ⚠️ プレリリースのお知らせ（Eagleアプリでは未検証）
このバージョンは**プレリリース版**です。新しいメタデータパーサーに対して200以上のテストコードを実行し動作確認を行っていますが、現在開発者がEagleアプリ本体を起動できる環境にないため、**Eagle上での実際の挙動については未テストです。**
もし動作に不具合があれば、GitHubのIssueにてご報告いただけると助かります。皆様のフィードバックをもとに正式版へとアップデートします。

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

#### 🔧 内部リファクタリング
- **メタデータパーサーのアーキテクチャ刷新**:
  - 保守性と拡張性を向上させるため、3層アーキテクチャ（バイナリ抽出 → フォーマット検出 → パース）に移行しました。
  - メタデータ抽出のメインエントリーポイントとして`MetadataService`を導入しました。
  - フォーマット固有のロジックを専用のパーサークラス（`ComfyUIParser`、`A1111Parser`）に分離しました。
  - `core.js`から重複コードを削除し、新しいアーキテクチャにパース処理を委譲しました。

#### 🧪 テスト
- 200以上のテストを含む包括的なテストスイートを追加:
  - 全パーサーコンポーネントのユニットテスト
  - 実際のサンプル画像を使用した統合テスト（ComfyUI、A1111、Civitai）
  - 堅牢性を確認するプロパティベーステスト
- メタデータ抽出の問題をトラブルシューティングするためのデバッグスクリプトを追加しました。

