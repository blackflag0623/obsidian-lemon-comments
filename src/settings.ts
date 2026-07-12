import { App, PluginSettingTab, Setting } from "obsidian";
import { t } from "./i18n";
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
      .setName(t("settings.highlightColor"))
      .setDesc(t("settings.highlightColorDesc"))
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
          .setTooltip(t("settings.resetColor"))
          .onClick(async () => {
            this.readingComments.pluginSettings.highlightColor =
              DEFAULT_SETTINGS.highlightColor;
            await this.readingComments.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.hoverDelay"))
      .setDesc(t("settings.hoverDelayDesc"))
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
      .setName(t("settings.popupWidth"))
      .setDesc(t("settings.popupWidthDesc"))
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
      .setName(t("settings.popupHeight"))
      .setDesc(t("settings.popupHeightDesc"))
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
      .setName(t("settings.smartSizing"))
      .setDesc(t("settings.smartSizingDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.readingComments.pluginSettings.autoFitPopupHeight)
          .onChange(async (value) => {
            this.readingComments.pluginSettings.autoFitPopupHeight = value;
            await this.readingComments.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("settings.maxWidth"))
      .setDesc(t("settings.maxWidthDesc"))
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
      .setName(t("settings.maxHeight"))
      .setDesc(t("settings.maxHeightDesc"))
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
      .setName(t("settings.shortcuts"))
      .setDesc(t("settings.shortcutsDesc"));
  }
}
