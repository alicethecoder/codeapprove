<template>
  <div
    v-hotkey="keymap"
    v-show="show"
    class="hotkey-overlay rounded border border-dark-0 bg-dark-5"
  >
    <div class="py-2 px-4 text-lg font-bold border-b border-dark-0 bg-dark-6">
      <font-awesome-icon icon="keyboard" class="ml-1 mr-2" /> Keyboard Shortcuts
    </div>
    <table class="my-2 mx-4">
      <tbody>
        <tr v-for="key in Object.keys(map)" :key="key">
          <td class="p-1">
            <div class="key mr-1" v-for="s in splitKey(key)" :key="s">
              <code>{{ s }}</code>
            </div>
          </td>
          <td class="pl-4">
            <span>{{ map[key].desc }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";
import { KeyDescMap } from "../../plugins/hotkeys";
import * as cookies from "../../plugins/cookies";

@Component
export default class HotkeyModal extends Vue {
  @Prop() map!: KeyDescMap;

  show = false;

  get keymap() {
    return {
      "alt+/": {
        keydown: this.onShow,
        keyup: this.onHide
      }
    };
  }

  public splitKey(key: string) {
    return key.split("+").map(k => k.toUpperCase());
  }

  private onShow() {
    this.$cookies.set(cookies.HOTKEY_MODAL_SHOWN, "true");
    this.show = true;
  }

  private onHide() {
    this.show = false;
  }
}
</script>

<style lang="postcss">
.hotkey-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;

  min-width: 40%;
  min-height: 40%;
}

.key {
  display: inline-block;
  box-sizing: border-box;
  min-width: 25px;
  height: 25px;

  padding: 4px 8px;

  font-size: 16px;
  line-height: 16px;
  font-weight: bold;

  color: #444d56;
  vertical-align: middle;
  text-align: center;
  background-color: #fcfcfc;
  border: 1px solid #c6cbd1;
  border-bottom-color: rgb(198, 203, 209);
  border-bottom-color: #959da5;
  border-radius: 3px;
  box-shadow: inset 0 -1px 0 #959da5;
}
</style>
