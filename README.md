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

* **Multi-Format Support**: 
    * ComfyUI workflows (complex multi-sampler support)
    * A1111 (Stable Diffusion WebUI) parameters
    * Civitai image generation metadata
* **Metadata Extraction**: Automatically detects and imports:
    * Checkpoint Name
    * LoRA Name
    * Positive / Negative Prompts
    * Generation Parameters (Seed, Steps, CFG, Sampler)
* **Flexible Output**:
    * **Tags**: Add extracted info to Eagle tags (e.g., `#checkpoint_name`, `#lora_name`, `seed:12345`).
    * **Notes (Annotation)**: Save full prompts and parameters in the Note section for easy copying.
* **Selective Import**: Toggle specific items (e.g., "Import Checkpoint but ignore Seed") via checkboxes.
* **Batch Processing**: Efficiently process multiple images with a progress bar.
* **Force Delete Mode**: Remove all tags and notes from selected items without analysis by holding **Shift** while clicking the "Delete Info" button.
* **Utility**: Includes a "Delete Info" button to remove tags/notes added by this plugin.

### 📸 Screenshots
...
#### 🧠 Advanced Workflow Trace Logic

Unlike simple metadata readers, this plugin dynamically analyzes the ComfyUI node graph to trace the actual execution path leading to the final image. Even within a massive "All-in-One" workflow, it accurately identifies and extracts parameters from the nodes that contributed to the generation.

| Workflow Overview | Extraction Result (Multi-Stage) |
| :---: | :---: |
| <img src="assets/workflow_image.png" width="500" alt="Complex Workflow"> | <img src="assets/workflow_trace_result.png" width="300" alt="Trace Result"> |

*   **Path-Based Extraction**: Automatically traces the latent/image chain back from the output nodes to filter out inactive nodes or unused branches.
*   **Multi-Stage Support**: Comprehensive extraction of seeds, prompts, and samplers from all stages, including KSampler, SAM Detailer, HiresFix, and FaceDetailer.
*   **Full Audit in Notes**: Records detailed metadata for every detected generation step in the Eagle Notes section for precise reproduction.

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

* **複数フォーマット対応**: 
    * ComfyUIワークフロー（複雑なマルチサンプラー対応）
    * A1111（Stable Diffusion WebUI）パラメータ
    * Civitai画像生成メタデータ
* **メタデータ抽出**: 以下の情報を自動検出・取り込み:
    * チェックポイント名
    * LoRA名
    * ポジティブ/ネガティブプロンプト
    * 生成パラメータ（Seed、Steps、CFG、Sampler）
* **柔軟な出力**:
    * **タグ**: 抽出した情報をEagleのタグに追加（例: `#checkpoint_name`, `#lora_name`, `seed:12345`）
    * **メモ（アノテーション）**: プロンプトやパラメータをメモ欄に保存し、簡単にコピー可能
* **選択的取り込み**: チェックボックスで特定の項目のみ取り込み可能（例: チェックポイントは取り込むがSeedは無視）
* **バッチ処理**: 複数画像を効率的に処理、進捗バー表示
* **強制削除モード**: 「情報を削除」ボタンを **Shiftキー** を押しながらクリックすることで、メタデータ解析を行わずに選択アイテムの全てのタグとメモを削除できます。
* **ユーティリティ**: このプラグインが追加したタグ・メモを削除する機能付き

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

### 🚀 使い方

1.  EagleでAI生成画像（ComfyUI/A1111/Civitai）を1つ以上選択
2.  右クリックして **「プラグイン」** > **「ComfyUI Auto Tagger」** を選択
3.  ポップアップウィンドウで:
    * **出力設定**: 「タグ」、「メモ」、または両方への追加を選択
    * **対象**: 抽出したいメタデータ項目をチェック（チェックポイント、LoRA、プロンプトなど）
4.  **「Start Tagging」** をクリック

### 🛠️ 開発

このプラグインは、外部依存なしでPNG tEXt/comfチャンクおよびWebP EXIF/XMPデータを解析し、AI生成メタデータを取得します。
* **対応フォーマット**: ComfyUI、A1111（Stable Diffusion WebUI）、Civitai
* **デバッグモード**: 右上のチェックボックスを有効にすると詳細ログを表示

#### 🧠 高度なワークフロー解析ロジック

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