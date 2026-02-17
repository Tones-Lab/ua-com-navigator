import { FileTitleRow } from '../../components/FileHeaderCommon';

type MibDetailsHeaderProps = {
  selectedFile: string;
  title: string;
  favoriteActive: boolean;
  onToggleFavorite: () => void;
};

export default function MibDetailsHeader({
  selectedFile,
  title,
  favoriteActive,
  onToggleFavorite,
}: MibDetailsHeaderProps) {
  return (
    <FileTitleRow
      title={title}
      path={selectedFile}
      favorite={{
        active: favoriteActive,
        onToggle: onToggleFavorite,
      }}
    />
  );
}
