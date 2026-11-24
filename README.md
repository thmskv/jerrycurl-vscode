# Jerrycurl for VS Code

Syntax highlighting, file icons and file templates for [Jerrycurl](https://github.com/thmskv/jerrycurl) files:

- `.cssql` — the Razor-flavoured SQL templates used by Jerrycurl MVC.
- `.orm` — Jerrycurl database configuration (JSON).

## Features

- **SQL** keywords (SQL:99 plus common vendor keywords, matching the Visual Studio extension), strings, numbers, operators and `--` / `/* */` comments.
- **Razor** syntax as understood by the Jerrycurl lexer:
  - Directives: `@query`, `@command`, `@input`, `@output`, `@visibility`, `@result`, `@model`, `@import`, `@namespace`, `@class`, `@template`, `@project`, `@inject`
  - Code blocks `@{ ... }`, explicit expressions `@( ... )` and implicit expressions such as `@R.Col(m => m.Id)`
  - Control flow: `@if`, `@else`, `@foreach`, `@for`, `@while`, `@using` — with SQL bodies between `{` and `}`
  - Comments `@* ... *@` and escapes `@@`, `{{`, `}}`
- **Embedded C#**, highlighted with VS Code's built-in C# grammar.
- **`.orm` files** get their own icon but are otherwise treated as JSON: highlighting, formatting, and validation against the `$schema` in the file.
- **File nesting** like in Visual Studio: generated `X.orm.cs` / `.orm.js` / `.orm.mjs` / `.orm.d.ts` files nest collapsed under `X.orm`. The extension enables `explorer.fileNesting` by default; turn it off in your settings if you don't want it.
- **File icons** for `.cssql` and `.orm`. They show up in file icon themes that support language icons (for example the default *Seti* theme).
- **New file templates** in C# Dev Kit's *New .NET File* picker (Solution Explorer → *New File...*): **Razor SQL Query** (a `.cssql` file starting with `@query`) and **Razor SQL Command** (starting with `@command`).

> If you previously had `"files.associations": { "*.orm": "json" }` in your settings, remove it — it overrides the Jerrycurl ORM language and hides the icon.

Toggle-comment (`Ctrl+/`) inserts SQL `--` line comments; toggle block comment (`Shift+Alt+A`) inserts Razor `@* *@` comments.

## Requirements

The extension depends on [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit), which VS Code installs along with it. The file templates are ordinary `dotnet new` item templates ([templates/](templates/)); on first start (and after each update) the extension registers them with `dotnet new install`, so the .NET SDK must be on your `PATH`. If they don't show up, run **Jerrycurl: Reinstall .cssql Item Templates** and check the *Jerrycurl* output channel; C# Dev Kit may need a window reload to pick up newly installed templates.

## Development

```sh
bun install
bun test                                  # grammar tests + every .cssql/.orm in libs/
bun run tokens some.cssql                 # dump tokens and scopes for a file
bun run package                           # build a .vsix
```

## Releases

Every push to `main` builds the extension and publishes a GitHub release with the `.vsix` attached ([.github/workflows/release.yml](.github/workflows/release.yml)). The version is `<major>.<minor>.<git height>`: major and minor come from `package.json` (the patch number there is ignored), and the git height is the number of commits since major.minor last changed. To start a new line of releases, bump major or minor in `package.json`. Run `bun scripts/version.mjs` to see the version the current commit would get.

Press `F5` to launch an Extension Development Host with `test/fixtures` open.
