/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
class Toolbar {
  constructor(openPalette) {
    this.openPalette = openPalette;
  }

  element(parent, text, highlight, handler) {
    let element;
    if (text == "|") {
      element = createChild(parent, "div", { class: "toolbar-line" });
    } else if (text == "-") {
      element = createChild(parent, "div", { class: "toolbar-separator" });
    } else if (handler == null) {
      element = createChild(parent, "span", { class: "toolbar-text" }, text);
    } else {
      element = createChild(parent, "button", { type: "button", class: "toolbar-linkbutton" }, text);
      element.onclick = function (event) {
        if (this.disabled) {
          return;
        }
        if (event && event.detail > 0) {
          this.blur();
        }
        if (this.classList.contains("selected")) {
          return;
        }
        handler(event, this);
      };
    }
    if (highlight) {
      element.classList.add("highlighted");
    }
    return element;
  }

  options(parent, label, values, selected, onSelect) {
    const line = this.element(parent, "|", false, null);
    this.element(line, label, false, null);
    const buttons = {};
    for (const [index, value] of Object.keys(values).entries()) {
      if (index > 0) {
        this.element(line, " ", false, null);
      }
      buttons[value] = this.element(line, value, false, () => onSelect(value));
      buttons[value].classList.add("option");
    }
    this.markSelected(buttons, selected);
    return buttons;
  }

  footer(parent, label, handler) {
    const footer = createChild(parent, "div", { class: "toolbar-footer" });
    const copyright = createChild(footer, "span", null, "Copyright \u00A9 ");
    const paletteButton = this.element(copyright, "QLike.com", false, this.openPalette);
    paletteButton.classList.add("copyright-link");
    paletteButton.setAttribute("aria-label", "QLike.com, open command palette");
    return this.element(footer, label, false, handler);
  }

  markSelected(buttons, value) {
    for (const key in buttons) {
      const selected = key == value;
      buttons[key].classList.toggle("selected", selected);
      buttons[key].setAttribute("aria-pressed", String(selected));
    }
  }

  setEnabled(element, enabled) {
    element.disabled = !enabled;
    element.classList.toggle("disabled", !enabled);
  }
}
