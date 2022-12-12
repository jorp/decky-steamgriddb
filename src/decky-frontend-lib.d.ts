import {
  SteamAppOverview as SteamAppOverviewO,
  SliderFieldProps as SliderFieldPropsO,
} from 'decky-frontend-lib';

declare module 'decky-frontend-lib' {
  export interface SteamAppOverview extends SteamAppOverviewO {
    appid: number,
    display_name: string,
    third_party_mod?: boolean,
    BIsModOrShortcut: () => boolean,
    BIsShortcut: () => boolean,
  }
  export interface SliderFieldProps extends SliderFieldPropsO {
    className?: string;
  }
}