
export type LinterIssue = {
  filePath: string;
  line: number;
  message: string;
  severity: 'warning' | 'error';
};

export type LegacyLinterReport = {
  issues: LinterIssue[];
  summary: {
    totalIssues: number;
    warnings: number;
    errors: number;
  };
};

export const lintLegacyFile = (filePath: string, content: string): LinterIssue[] => {
  const issues: LinterIssue[] = [];
  const lines = content.split(/\r?\n/);

  // Rule: Detect long lines
  lines.forEach((line, index) => {
    if (line.length > 120) {
      issues.push({
        filePath,
        line: index + 1,
        message: `Line is longer than 120 characters (length ${line.length}).`,
        severity: 'warning',
      });
    }
  });

  // Rule: Detect overly complex regex
  lines.forEach((line, index) => {
    try {
      const regexPattern = new RegExp('\\/(.+?)\\/', 'g');
      let match;
      while ((match = regexPattern.exec(line)) !== null) {
        const regexContent = match[1];
        if (regexContent.length > 25) {
          issues.push({
            filePath,
            line: index + 1,
            message: `Overly complex regex found (length ${regexContent.length}). Consider simplifying.`,
            severity: 'warning',
          });
        }
      }
    } catch (e: any) {
      issues.push({
        filePath,
        line: index + 1,
        message: `Could not parse regex: ${e.message}`,
        severity: 'error',
      });
    }
  });

  // Rule: Detect unused variables
  const declaredVars = new Map<string, { line: number }>();
  const varDeclarationRegex = /my \$([a-zA-Z0-9_]+)/g;
  let match;
  while ((match = varDeclarationRegex.exec(content)) !== null) {
    const varName = match[1];
    // Find the line number for the declaration
    const line = content.substring(0, match.index).split(/\r?\n/).length;
    declaredVars.set(varName, { line });
  }

  declaredVars.forEach((info, varName) => {
    const usageRegex = new RegExp(`\\$${varName}\\b`, 'g');
    const matches = content.match(usageRegex);
    if (!matches || matches.length <= 1) { // <= 1 to account for the declaration itself if it matches
      issues.push({
        filePath,
        line: info.line,
        message: `Variable "$${varName}" is declared but never used.`,
        severity: 'warning',
      });
    }
  });


  return issues;
};

export const runLegacyLinter = (files: { filePath: string; content: string }[]): LegacyLinterReport => {
  const allIssues = files.flatMap(file => lintLegacyFile(file.filePath, file.content));
  const warnings = allIssues.filter(issue => issue.severity === 'warning').length;
  const errors = allIssues.filter(issue => issue.severity === 'error').length;

  return {
    issues: allIssues,
    summary: {
      totalIssues: allIssues.length,
      warnings,
      errors,
    },
  };
};