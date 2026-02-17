import AuthenticatedMainContent from './AuthenticatedMainContent';
import UserPreferencesModal from './UserPreferencesModal';

type MainContentShellProps = {
  authenticatedMainContentProps: any;
  userPreferencesModalProps: any;
};

export default function MainContentShell({
  authenticatedMainContentProps,
  userPreferencesModalProps,
}: MainContentShellProps) {
  return (
    <main className="app-main">
      <AuthenticatedMainContent {...authenticatedMainContentProps} />
      <UserPreferencesModal {...userPreferencesModalProps} />
    </main>
  );
}