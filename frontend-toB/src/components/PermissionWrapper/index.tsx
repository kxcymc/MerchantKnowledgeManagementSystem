import React from 'react';

type PermissionWrapperProps = {
  backup?: React.ReactNode;
};

// Simplified PermissionWrapper: always render children if present,
// otherwise render backup. Permissions are bypassed so all users see everything.
const PermissionWrapper = (props: React.PropsWithChildren<PermissionWrapperProps>) => {
  const { backup } = props;
  if (props.children) {
    return <>{convertReactElement(props.children)}</>;
  }
  if (backup) {
    return <>{convertReactElement(backup)}</>;
  }
  return null;
};

function convertReactElement(node: React.ReactNode): React.ReactElement {
  if (!React.isValidElement(node)) {
    return <>{node}</>;
  }
  return node;
}

export default PermissionWrapper;
