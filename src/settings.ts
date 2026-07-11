import { App, PluginSettingTab, Setting } from "obsidian";
import type ReadingCommentsPlugin from "./main";
import { DEFAULT_SETTINGS } from "./types";

export class ReadingCommentsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly readingComments: ReadingCommentsPlugin) {
    super(app, readingComments);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("高亮颜色")
      .setDesc("阅读模式中，被评论文字使用的柠檬色高亮。")
      .addColorPicker((picker) =>
        picker
          .setValue(this.readingComments.pluginSettings.highlightColor)
          .onChange(async (value) => {
            this.readingComments.pluginSettings.highlightColor = value;
            await this.readingComments.saveSettings();
          })
      )
      .addExtraButton((button) =>
        button
          .setIcon("reset")
          .setTooltip("恢复默认颜色")
          .onClick(async () => {
            this.readingComments.pluginSettings.highlightColor =
              DEFAULT_SETTINGS.highlightColor;
            await this.readingComments.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("悬停显示延迟")
      .setDesc("鼠标停留多久后显示评论，单位为毫秒。")
      .addSlider((slider) =>
        slider
          .setLimits(0, 800, 20)
          .setValue(this.readingComments.pluginSettings.hoverDelay)
          .onChange(async (value) => {
            this.readingComments.pluginSettings.hoverDelay = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("评论弹窗默认宽度")
      .setDesc("新增、编辑及悬停阅读评论弹窗的默认宽度，单位为像素。")
      .addSlider((slider) =>
        slider
          .setLimits(300, 900, 10)
          .setValue(this.readingComments.pluginSettings.popupWidth)
          .onChange(async (value) => {
            this.readingComments.pluginSettings.popupWidth = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("评论弹窗默认高度")
      .setDesc("固定高度模式下，所有评论弹窗的高度，单位为像素。")
      .addSlider((slider) =>
        slider
          .setLimits(240, 900, 10)
          .setValue(this.readingComments.pluginSettings.popupHeight)
          .onChange(async (value) => {
            this.readingComments.pluginSettings.popupHeight = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("阅读弹窗智能自适应")
      .setDesc(
        "始终紧贴高亮文字上方或下方，不会居中或覆盖高亮。完整内容放不下时，选择空间更大的一侧并在窗口内滚动。"
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.readingComments.pluginSettings.autoFitPopupHeight)
          .onChange(async (value) => {
            this.readingComments.pluginSettings.autoFitPopupHeight = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("自适应最大宽度")
      .setDesc("悬停阅读弹窗最多占 Obsidian 窗口宽度的百分比。")
      .addSlider((slider) =>
        slider
          .setLimits(30, 95, 5)
          .setValue(
            this.readingComments.pluginSettings.autoFitMaxWidthPercent
          )
          .onChange(async (value) => {
            this.readingComments.pluginSettings.autoFitMaxWidthPercent =
              value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("自适应最大高度")
      .setDesc("悬停阅读弹窗最多占 Obsidian 窗口高度的百分比。")
      .addSlider((slider) =>
        slider
          .setLimits(30, 95, 5)
          .setValue(
            this.readingComments.pluginSettings.autoFitMaxHeightPercent
          )
          .onChange(async (value) => {
            this.readingComments.pluginSettings.autoFitMaxHeightPercent =
              value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("编辑快捷键")
      .setDesc("Enter 保存；Shift+Enter 换行；Esc 取消。点击弹窗外也会保存。");
  }
}
