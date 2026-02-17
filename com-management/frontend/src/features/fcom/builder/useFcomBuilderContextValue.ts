import type { FcomBuilderContextValue } from './FcomBuilderContext';

type UseFcomBuilderContextValueParams = Omit<FcomBuilderContextValue, 'builderOverrideVersion'> & {
  getOverrideVersionInfo: (objectName?: string | null) => FcomBuilderContextValue['builderOverrideVersion'];
  getObjectByPanelKey: (panelKey: string) => Record<string, unknown> | null | undefined;
};

export default function useFcomBuilderContextValue({
  builderTarget,
  getOverrideVersionInfo,
  getObjectByPanelKey,
  ...rest
}: UseFcomBuilderContextValueParams): FcomBuilderContextValue {
  const builderObject = builderTarget ? getObjectByPanelKey(builderTarget.panelKey) : null;
  const builderObjectName =
    builderObject && typeof builderObject['@objectName'] === 'string'
      ? builderObject['@objectName']
      : null;
  const builderOverrideVersion = builderTarget
    ? getOverrideVersionInfo(builderObjectName)
    : null;

  return {
    ...rest,
    builderTarget,
    builderOverrideVersion,
  };
}
