import Vue from "vue";

import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faCaretRight,
  faCaretDown,
  faPauseCircle,
  faUserCheck,
  faAt,
  faPaperPlane,
  faCheck,
  faCodeBranch,
  faComment,
  faEye,
  faEyeSlash,
  faExclamation,
  faMagic,
  faKeyboard,
  faPlus,
  faMinus,
  faThumbsUp,
  faCircle,
  faTimes,
  faDoorOpen,
  faExclamationCircle,
  faBell,
  faTasks,
  faMoon,
  faHistory,
  faCog,
  faBookmark
} from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

export function initIconLibrary() {
  Vue.component("font-awesome-icon", FontAwesomeIcon);

  library.add(
    // Regular icons
    faCaretRight,
    faCaretDown,
    faPauseCircle,
    faUserCheck,
    faAt,
    faPaperPlane,
    faCheck,
    faCodeBranch,
    faComment,
    faEye,
    faEyeSlash,
    faExclamation,
    faMagic,
    faKeyboard,
    faPlus,
    faMinus,
    faThumbsUp,
    faCircle,
    faTimes,
    faDoorOpen,
    faExclamationCircle,
    faBell,
    faTasks,
    faMoon,
    faHistory,
    faCog,
    faBookmark,

    // Brand icons
    faGithub
  );
}
