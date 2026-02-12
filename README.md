# ComfyUI Auto Tagger for Eagle

<p align="center">
  <img src="logo.png" width="128" alt="ComfyUI Auto Tagger Logo">
</p>

[English](#english) | [日本語](#japanese)

<a name="english"></a>

## 🇬🇧 English

**ComfyUI Auto Tagger** is a plugin for [Eagle](https://en.eagle.cool/) that automatically extracts metadata (Workflow/Prompt JSON) from AI-generated images and saves them as Eagle **Tags** and **Notes**.

It supports **ComfyUI**, **Stable Diffusion WebUI** (including Automatic1111, Forge, and other variants; referred to as "A1111" below), and **Civitai** generated images in both **PNG** and **WebP** formats, and allows you to filter which information to import.

### ✨ Features

* **Multi-Format Support**: Supports ComfyUI workflows (including complex multi-sampler), A1111 (Stable Diffusion WebUI) parameters, and Civitai generation metadata.
* **Metadata Extraction**: Automatically detects Checkpoint, LoRA, Prompts (Positive/Negative), and Generation Parameters (Seed, Steps, CFG, Sampler).
* **Flexible Output**:
    * **Tags**: Adds extracted info to Eagle tags (e.g., `#checkpoint_name`, `#lora_name`, `seed:12345`).
    * **Notes (Annotation)**: Saves full prompts and parameters in the Note section for easy reference.
* **Selective Import**: Allows toggling specific items (e.g., "Import Checkpoint but ignore Seed") via checkboxes.
* **Batch Processing**: Efficiently processes multiple images with a progress bar.
* **Force Delete Mode**: Removes all tags and notes from selected items without analysis (Shift + Click on "Delete Info").
* **Debug Mode**: Detailed logs for troubleshooting (toggle via checkbox).
* **No External Dependencies**: Parses PNG/WebP chunks directly (tEXt, comf, Exif) without relying on heavy external libraries.
* **Utility**: Provides a dedicated button to safely remove only the tags/notes added by this plugin.

### 📸 Screenshots

<p align="center">
  <img src="assets/processing_movie_full.gif" alt="Processing Demo" width="100%">
</p>

| Output Result | Settings UI |
| :---: | :---: |
| <img src="assets/preview-result.png" width="400" alt="Result Overview"> | <img src="assets/preview-settings.png" width="400" alt="Settings Window"> |

### 🧠 Advanced Workflow Trace Logic

Unlike simple metadata readers, this plugin dynamically analyzes the ComfyUI node graph to trace the actual execution path leading to the final image. Even within a massive "All-in-One" workflow, it accurately identifies and extracts parameters from the nodes that contributed to the generation.

| Workflow Overview | Extraction Result (Multi-Stage) |
| :---: | :---: |
| <img src="assets/workflow_image.png" width="500" alt="Complex Workflow"> | <img src="assets/workflow_trace_result.png" width="300" alt="Trace Result"> |

*   **Path-Based Extraction**: Automatically traces the latent/image chain back from the output nodes to filter out inactive nodes or unused branches.
*   **Multi-Stage Support**: Comprehensive extraction of seeds, prompts, and samplers from all stages, including KSampler, SAM Detailer, HiresFix, and FaceDetailer.
*   **Full Audit in Notes**: Records detailed metadata for every detected generation step in the Eagle Notes section for precise reproduction.

### 🏗️ Architecture

This plugin features an advanced metadata parser that intelligently extracts generation information from AI images.

- **Multi-Format Support**: Automatically detects and extracts metadata from ComfyUI, A1111, and Civitai images
- **Intelligent Analysis**: Uses advanced algorithms to accurately identify generation parameters even in complex workflows
- **Reliable Extraction**: Robust error handling ensures the plugin continues working even with unusual or incomplete metadata

For technical details, see [ARCHITECTURE.md](js/metadata-parser/ARCHITECTURE.md).

### ⚠️ Disclaimer & Bug Reports

*   **Disclaimer**: ComfyUI workflows can be extremely complex. 100% compatibility is not guaranteed. This plugin operates on the advanced trace logic to identify the most relevant generation parameters.
*   **Bug Reports**: When reporting issues on GitHub, please always attach:
    1.  Information about your generation environment (ComfyUI/A1111 version, custom nodes used, etc.).
    2.  The original image (PNG/WebP) that retains its metadata.

### 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<a name="japanese"></a>

## 🇯🇵 日本語

**ComfyUI Auto Tagger** は、画像収集管理ソフト [Eagle](https://jp.eagle.cool/) 用のプラグインです。
AI画像生成ツールで生成された画像に含まれるメタデータ（Workflow/Prompt）を解析し、モデル名やプロンプトなどを自動でEagleの「タグ」や「メモ」に追加します。

**ComfyUI**、**Stable Diffusion WebUI**（Automatic1111、Forge等の派生版を含む。以下「A1111」と表記）、**Civitai** で生成された **PNG** および **WebP** 形式の画像に対応しており、取り込む情報を選択できます。

### ✨ 機能

* **複数フォーマット対応**: ComfyUIワークフロー（複雑なマルチサンプラー対応）、A1111（Stable Diffusion WebUI）、Civitai生成画像に対応。
* **メタデータ抽出**: チェックポイント、LoRA、プロンプト（Positive/Negative）、生成パラメータ（Seed, Steps, CFG, Sampler）を自動検出。
* **柔軟な出力先**:
    * **タグ**: 抽出した情報をEagleのタグとして追加（例: `#checkpoint_name`, `seed:12345`）。
    * **メモ（アノテーション）**: プロンプトやパラメータの詳細をメモ欄に保存し、参照・コピーを容易に。
* **選択的取り込み**: チェックボックスで必要な情報のみ（例: チェックポイントのみ）を選択して取り込み可能。
* **バッチ処理**: 複数画像をまとめて効率的に処理し、進捗状況を表示。
* **強制削除モード**: Shiftキーを押しながら削除ボタンをクリックすることで、解析を行わずにタグ・メモを一括削除。
* **デバッグモード**: 詳細なログを表示してトラブルシューティングを支援（チェックボックスで切替）。
* **外部依存なし**: PNG/WebPの内部データ（tEXt, comf, Exif）を直接解析するため、重い外部ライブラリに依存せず動作。
* **ユーティリティ**: このプラグインが生成したタグやメモのみを安全に削除する機能を提供。

### 📸 スクリーンショット

<p align="center">
  <img src="assets/processing_movie_full.gif" alt="処理デモ" width="100%">
</p>

| 出力結果 | 設定画面 |
| :---: | :---: |
| <img src="assets/preview-result.png" width="400" alt="結果概要"> | <img src="assets/preview-settings.png" width="400" alt="設定ウィンドウ"> |

### 📦 インストール

1.  [Releasesページ](https://github.com/NNNebel/comfyui-auto-tagger/releases)から最新の `.eagleplugin` ファイルをダウンロード
2.  Eagleを起動
3.  `.eagleplugin` ファイルをEagleウィンドウにドラッグ&ドロップ
4.  必要に応じてEagleを再起動

### 🏗️ アーキテクチャ

本プラグインは、グラフベースの解析とハンドラーシステムを採用した高度なメタデータパーサーを搭載しています。

- **グラフベースのComfyUI解析**: ノードグラフを明示的に構築し、トラバーサルアルゴリズムでベースサンプラーを正確に特定
- **拡張可能なA1111パラメータパース**: ハンドラーシステムにより、新しいパラメータタイプを簡単に追加可能
- **構造化されたプロンプトトークン化**: 重み付きテキスト、LoRAタグ、ネストされた括弧を正確に解析
- **詳細なエラーハンドリング**: コンテキストと提案を含む特定のエラータイプで問題を明確化

詳細は [ARCHITECTURE.md](js/metadata-parser/ARCHITECTURE.md) を参照してください。

### 🚀 使い方

1.  EagleでAI生成画像（ComfyUI/A1111/Civitai）を1つ以上選択
2.  右クリックして **「プラグイン」** > **「ComfyUI Auto Tagger」** を選択
3.  ポップアップウィンドウで:
    * **出力設定**: 「タグ」、「メモ」、または両方への追加を選択
    * **対象**: 抽出したいメタデータ項目をチェック（チェックポイント、LoRA、プロンプトなど）
### 🧠 高度なワークフロー解析ロジック

単なるメタデータの読み取りではなく、ComfyUIのノードグラフを動的に解析し、最終的な画像出力に至るまでの実際の実行ルートを特定します。これにより、どれほど巨大で複雑な「オールインワン」ワークフローであっても、生成に関与したノードから正確にパラメータを抽出します。

| ワークフロー全体像 | 抽出結果（マルチステージ） |
| :---: | :---: |
| <img src="assets/workflow_image.png" width="500" alt="Complex Workflow"> | <img src="assets/workflow_trace_result.png" width="300" alt="Trace Result"> |

*   **実行経路の動的探索**: 出力ノードから潜在空間や画像の連鎖を逆引きし、画像生成に使用されていない不要なブランチの情報は除外します。
*   **マルチステージ対応**: KSampler、SAM Detailer、HiresFix、FaceDetailerなど、経路上のあらゆる工程からシード値、プロンプト、サンプラー情報を網羅的に取得します。
*   **詳細な履歴保存**: Eagleのメモ欄には、検出されたすべての生成ステップごとのメタデータが記録され、後からの正確な振り返りが可能です。

### ⚠️ 免責事項・不具合報告

*   **免責事項**: ComfyUIのWorkflowは非常に複雑なため、100%の動作は保証できません。本プラグインは、高度な解析ロジックに基づいて最も関連性の高い生成パラメータを特定します。
*   **不具合報告**: GitHubのIssueで報告する際は、以下の2点を必ず添付してください。
    1.  生成環境の情報（ComfyUI/A1111のバージョン、使用しているカスタムノード等）
    2.  メタデータが保持された画像の実ファイル（PNG/WebP）

### 📄 ライセンス

本プラグインは [MIT License](LICENSE) のもとで公開されています。商用・非商用を問わず、自由にご利用・改変いただけます。