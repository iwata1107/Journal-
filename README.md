# Journal Site

## 画像・動画の置き方

ジャーナル本文から参照する画像・動画は、Markdownファイルの近くに置くと管理しやすいです。

```text
2026/05/2026-05-11.md
2026/05/media/photo.jpg
2026/05/media/demo.mp4
```

Markdownには次のように書きます。

```md
![写真の説明](media/photo.jpg "写真のキャプション")
![動画の説明](media/demo.mp4 "動画のキャプション")
```

動画は明示的に書くこともできます。

```md
[video: デモ動画](media/demo.mp4 "操作デモ")
```

対応形式:

- 画像: `jpg`, `jpeg`, `png`, `gif`, `webp`, `svg`, `avif`
- 動画: `mp4`, `webm`, `mov`, `m4v`, `ogv`

更新したら、公開前にデータを再生成します。

```bash
node scripts/build-journal-site.mjs
```

GitHub Pagesへ反映する場合は、mainへコミットしてpushします。

このリポジトリはGitHub Pagesの公開元を `main` ブランチの `/` にしています。

GitHubの通常ファイル上限に引っかかる大きな動画は、外部ストレージやYouTube等に置いてURL参照にしてください。
