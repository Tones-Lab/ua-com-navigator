import type { FcomBuilderContextValue } from './FcomBuilderContext';

type UseFcomBuilderContextValueParams = Omit<FcomBuilderContextValue, 'builderOverrideVersion'> & {
  getOverrideVersionInfo: (objectName?: string | null) => FcomBuilderContextValue['builderOverrideVersion'];
  getObjectByPanelKey: (panelKey: string) => any;
};

export default function useFcomBuilderContextValue({
  builderTarget,
  getOverrideVersionInfo,
  getObjectByPanelKey,
  ...rest
}: UseFcomBuilderContextValueParams): FcomBuilderContextValue {
  const builderOverrideVersion = builderTarget
    ? getOverrideVersionInfo(getObjectByPanelKey(builderTarget.panelKey)?.['@objectName'])
    : null;

  return {
    ...rest,
    builderTarget,
    builderOverrideVersion,
  };
}
