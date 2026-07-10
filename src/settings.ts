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
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.readingComments.pluginSettings.hoverDelay = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("评论弹窗默认宽度")
      .setDesc("评论编辑弹窗的默认宽度，单位为像素。")
      .addSlider((slider) =>
        slider
          .setLimits(300, 900, 10)
          .setValue(this.readingComments.pluginSettings.popupWidth)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.readingComments.pluginSettings.popupWidth = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("评论弹窗默认高度")
      .setDesc("固定高度模式下的弹窗高度，单位为像素。")
      .addSlider((slider) =>
        slider
          .setLimits(240, 900, 10)
          .setValue(this.readingComments.pluginSettings.popupHeight)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.readingComments.pluginSettings.popupHeight = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("高度自动适应内容")
      .setDesc(
        "开启后忽略默认高度，输入区和 Markdown 预览会随内容自动伸缩；超过视口时才滚动整个弹窗。"
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
      .setName("编辑快捷键")
      .setDesc("Enter 保存；Shift+Enter 换行；Esc 取消。点击弹窗外也会保存。");
  }
}
