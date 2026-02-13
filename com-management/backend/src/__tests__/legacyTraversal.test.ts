import fs from 'fs';
import path from 'path';
import { convertLegacyRules, discoverLegacyTraversal } from '../services/legacy/legacyConversion';

type TempContext = {
  root: string;
  cleanup: () => void;
};

const baseTempRoot = '/root/navigator/tmp/legacy-tests';

const matchEnvBackup = process.env.LEGACY_MATCH_EXISTING;

beforeAll(() => {
  process.env.LEGACY_MATCH_EXISTING = 'false';
});

afterAll(() => {
  if (matchEnvBackup === undefined) {
    delete process.env.LEGACY_MATCH_EXISTING;
  } else {
    process.env.LEGACY_MATCH_EXISTING = matchEnvBackup;
  }
});

const createTempRoot = (): TempContext => {
  fs.mkdirSync(baseTempRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(baseTempRoot, 'legacy-'));
  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
};

const writeFile = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};

describe('legacy traversal discovery', () => {
  it('handles a barebones single file input', () => {
    const temp = createTempRoot();
    try {
      const rulesFile = path.join(temp.root, 'sample.rules');
      writeFile(
        rulesFile,
        '# Name: SampleRule\n$rulesfile = "Sample.rules";\n$Event->{Severity} = 3;\n',
      );

      const result = discoverLegacyTraversal([rulesFile]);
      expect(result.orderedFiles).toHaveLength(1);
      expect(result.orderedFiles[0]).toBe(rulesFile);
    } finally {
      temp.cleanup();
    }
  });

  it('uses base.rules dispatch order when available', () => {
    const temp = createTempRoot();
    try {
      const baseIncludes = path.join(temp.root, 'base.includes');
      const baseRules = path.join(temp.root, 'base.rules');
      const baseLoad = path.join(temp.root, 'base.load');
      const fooRules = path.join(temp.root, 'foo.rules');
      const barRules = path.join(temp.root, 'bar.rules');
      const extraRules = path.join(temp.root, 'other.rules');
      const extraPl = path.join(temp.root, 'extra.pl');

      writeFile(
        baseIncludes,
        [
          'fooRule, foo.rules',
          'barRule, bar.rules',
          'externalRule, /opt/external.rules',
          'lookupRule, lookup.pl',
        ].join('\n'),
      );
      writeFile(baseLoad, ['fooRule();', 'lookupRule();', 'missingLoad();'].join('\n'));
      writeFile(
        baseRules,
        [
          "if ($enterprise == '1.2.3') {",
          '  fooRule();',
          '}',
          "elsif ($enterprise == '1.2.4') {",
          '  barRule();',
          '  missingRule();',
          '}',
        ].join('\n'),
      );
      writeFile(fooRules, '# Name: fooRule\n$Event->{Severity} = 1;');
      writeFile(barRules, '# Name: barRule\n$Event->{Severity} = 2;');
      writeFile(extraRules, '# Name: extraRule\n$Event->{Severity} = 3;');
      writeFile(extraPl, "'minor' => { Severity => '4', EventCategory => '2' };");

      const result = discoverLegacyTraversal([temp.root]);
      expect(result.orderedFiles[0]).toBe(fooRules);
      expect(result.orderedFiles[1]).toBe(barRules);
      expect(result.orderedFiles).toContain(extraRules);
      expect(result.orderedFiles).toContain(extraPl);
      expect(result.loadCalls).toEqual(expect.arrayContaining(['fooRule', 'lookupRule', 'missingLoad']));
      expect(result.missingLoadCalls).toEqual(expect.arrayContaining(['lookupRule', 'missingLoad']));
      expect(result.missingIncludePaths).toEqual(expect.arrayContaining(['lookup.pl']));
      expect(result.missingLookupFiles).toEqual(expect.arrayContaining(['lookup.pl']));
      expect(result.missingFunctions).toEqual(
        expect.arrayContaining(['missingRule', 'externalRule']),
      );
    } finally {
      temp.cleanup();
    }
  });

  it('traverses subfolders when root has no base files', () => {
    const temp = createTempRoot();
    try {
      const alphaDir = path.join(temp.root, 'alpha');
      const betaDir = path.join(temp.root, 'beta');
      const alphaBaseRules = path.join(alphaDir, 'base.rules');
      const alphaIncludes = path.join(alphaDir, 'base.includes');
      const betaBaseRules = path.join(betaDir, 'base.rules');
      const betaIncludes = path.join(betaDir, 'base.includes');
      const alphaRules = path.join(alphaDir, 'alpha.rules');
      const betaRules = path.join(betaDir, 'beta.rules');

      writeFile(alphaIncludes, 'alphaRule, alpha.rules');
      writeFile(alphaBaseRules, 'if ($enterprise) {\n  alphaRule();\n}');
      writeFile(alphaRules, '# Name: alphaRule\n$Event->{Severity} = 1;');

      writeFile(betaIncludes, 'betaRule, beta.rules');
      writeFile(betaBaseRules, 'if ($enterprise) {\n  betaRule();\n}');
      writeFile(betaRules, '# Name: betaRule\n$Event->{Severity} = 1;');

      const result = discoverLegacyTraversal([temp.root]);
      const alphaIndex = result.orderedFiles.indexOf(alphaRules);
      const betaIndex = result.orderedFiles.indexOf(betaRules);
      expect(alphaIndex).toBeGreaterThanOrEqual(0);
      expect(betaIndex).toBeGreaterThanOrEqual(0);
      expect(alphaIndex).toBeLessThan(betaIndex);
    } finally {
      temp.cleanup();
    }
  });

  it('includes traversal details in conversion report', () => {
    const temp = createTempRoot();
    try {
      const baseIncludes = path.join(temp.root, 'base.includes');
      const baseRules = path.join(temp.root, 'base.rules');
      const baseLoad = path.join(temp.root, 'base.load');
      const ruleFile = path.join(temp.root, 'alpha.rules');

      writeFile(baseIncludes, 'alphaRule, alpha.rules');
      writeFile(baseRules, 'if ($enterprise) {\n  alphaRule();\n}');
      writeFile(baseLoad, 'alphaRule();');
      writeFile(
        ruleFile,
        [
          '# Name: alphaRule',
          '$Event->{Severity} = 1;',
          '$Event->{HelpKey} = "help-key";',
          '$Event->{Node} = "node-a";',
          '$Event->{SubNode} = "sub-node";',
        ].join('\n'),
      );

      const report = convertLegacyRules({ inputs: [temp.root] });
      expect(report.traversal.orderedFiles).toContain(ruleFile);
      expect(report.traversal.entries.length).toBeGreaterThan(0);
      expect(report.traversal.loadCalls).toEqual(expect.arrayContaining(['alphaRule']));
      expect(report.legacyObjects[0].helpKeys).toEqual(expect.arrayContaining(['"help-key"']));
      expect(report.legacyObjects[0].nodeValues).toEqual(expect.arrayContaining(['"node-a"']));
      expect(report.legacyObjects[0].subNodeValues).toEqual(expect.arrayContaining(['"sub-node"']));
    } finally {
      temp.cleanup();
    }
  });

  it('treats $Event files as fault and filters IPs from OID list', () => {
    const temp = createTempRoot();
    try {
      const ruleFile = path.join(temp.root, 'event.rules');
      writeFile(
        ruleFile,
        [
          '# Name: eventRule',
          '$Event->{Severity} = 1;',
          '$Event->{Summary} = "Test";',
          '$Event->{Node} = "10.1.2.3";',
          '$Event->{HelpKey} = "help";',
          'my $oid = "1.2.3.4.5";',
        ].join('\n'),
      );

      const report = convertLegacyRules({ inputs: [temp.root] });
      const classification = report.classifications.find((entry) => entry.filePath === ruleFile);
      expect(classification?.ruleType).toBe('fault');
      const obj = report.legacyObjects.find((entry) => entry.sourceFile === ruleFile);
      expect(obj?.oids).toEqual(['1.2.3.4.5']);
      expect(obj?.nodeValues?.some((value) => value.includes('10.1.2.3'))).toBe(true);
    } finally {
      temp.cleanup();
    }
  });

  it('flags performance when MetricID or Find() hints exist', () => {
    const temp = createTempRoot();
    try {
      const perfFile = path.join(temp.root, 'perf.rules');
      writeFile(
        perfFile,
        [
          '# Name: perfRule',
          '$MetricID = 42;',
          'my $value = FindMetricValue();',
          'my %metrics = ("foo" => "1.3.6.1.2.1.1.1");',
        ].join('\n'),
      );

      const report = convertLegacyRules({ inputs: [temp.root] });
      const classification = report.classifications.find((entry) => entry.filePath === perfFile);
      expect(classification?.ruleType).toBe('performance');
      expect(classification?.evidence.performanceHints.length).toBeGreaterThan(0);
      const obj = report.legacyObjects.find((entry) => entry.sourceFile === perfFile);
      expect(obj?.performanceHints.length).toBeGreaterThan(0);
      expect(obj?.classificationHints.length).toBeGreaterThan(0);
    } finally {
      temp.cleanup();
    }
  });

  it('skips base.rules objects and classifies it as unknown', () => {
    const temp = createTempRoot();
    try {
      const baseRules = path.join(temp.root, 'base.rules');
      writeFile(
        baseRules,
        [
          "if ($enterprise == '1.2.3') {",
          '  fooRule();',
          '}',
        ].join('\n'),
      );

      const report = convertLegacyRules({ inputs: [temp.root] });
      const classification = report.classifications.find((entry) => entry.filePath === baseRules);
      expect(classification?.ruleType).toBe('unknown');
      const baseObjects = report.legacyObjects.filter((entry) => entry.sourceFile === baseRules);
      expect(baseObjects.length).toBe(0);
    } finally {
      temp.cleanup();
    }
  });

  it('builds bundle and folder/file summaries', () => {
    const temp = createTempRoot();
    try {
      const folder = path.join(temp.root, 'rules');
      const fileA = path.join(folder, 'a.rules');
      const fileB = path.join(folder, 'b.rules');
      writeFile(fileA, '# Name: aRule\n$Event->{Severity} = 1;');
      writeFile(fileB, '# Name: bRule\n$MetricID = 1;');

      const report = convertLegacyRules({ inputs: [temp.root] });
      expect(report.bundle.overrides.length).toBe(report.overrideProposals.length);
      expect(report.summaries.byFolder.length).toBeGreaterThan(0);
      expect(report.summaries.byFile.length).toBeGreaterThan(0);
    } finally {
      temp.cleanup();
    }
  });

  it('matches legacy objects against local coms fixtures', () => {
    const temp = createTempRoot();
    const previousMatchEnv = process.env.LEGACY_MATCH_EXISTING;
    process.env.LEGACY_MATCH_EXISTING = 'true';
    try {
      const comsDir = path.join(temp.root, 'coms', 'trap', 'acme');
      const comFile = path.join(comsDir, 'ACME-TEST-FCOM.json');
      writeFile(
        comFile,
        JSON.stringify(
          {
            objects: [
              {
                '@objectName': 'ACME-TEST::LinkDown',
                event: { Summary: 'Existing summary', Severity: 5, EventCategory: 2 },
                trap: { oid: '1.3.6.1.4.1.9999.1.0.1' },
              },
            ],
          },
          null,
          2,
        ),
      );

      const legacyDir = path.join(temp.root, 'legacy');
      const legacyFile = path.join(legacyDir, 'legacy.rules');
      writeFile(
        legacyFile,
        [
          'sub LinkDown {',
          '  my $trapoid = "1.3.6.1.4.1.9999.1.0.1";',
          '  $Event->{Summary} = "Legacy summary";',
          '  $Event->{Severity} = 3;',
          '}',
        ].join('\n'),
      );

      const report = convertLegacyRules({ inputs: [legacyDir] });
      expect(report.matchDiffs.length).toBeGreaterThan(0);
      const match = report.matchDiffs[0];
      expect(match.matchMethod).toBe('oid');
      expect(Number(match.matchScore || 0)).toBeGreaterThan(0);
      expect(match.matchedObject?.name).toBe('ACME-TEST::LinkDown');
    } finally {
      if (previousMatchEnv === undefined) {
        delete process.env.LEGACY_MATCH_EXISTING;
      } else {
        process.env.LEGACY_MATCH_EXISTING = previousMatchEnv;
      }
      temp.cleanup();
    }
  });
});
