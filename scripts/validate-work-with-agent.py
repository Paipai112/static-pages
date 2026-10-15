#!/usr/bin/env python3
"""Offline integrity check. Not a formal PR verdict, permission or approval check.

A verified fixed source is required. Never run proposed check code in place of the
trusted default-branch checker for a target PR. No network or file mutations.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import tarfile
sys.dont_write_bytecode = True

SOURCE_SHA = '16907ce50b124ff59d39ea3c4bb74498ef576636'
SOURCE_URL = 'https://github.com/Paipai112/Work-with-Agent'
SKILLS = ('github-collaboration-setup', 'github-collaboration', 'github-collaboration-check')
BASE = '.github/agent-collaboration/'


def require(ok, message):
    if not ok:
        raise ValueError(message)


def regular(root, rel):
    require(isinstance(rel, str) and rel and '\\' not in rel, f'unsafe path: {rel!r}')
    parts = rel.split('/')
    require(not rel.startswith('/') and all(x not in ('', '.', '..') for x in parts), f'unsafe path: {rel}')
    path = root
    for index, part in enumerate(parts):
        path = path / part
        info = os.lstat(path)
        require(not stat.S_ISLNK(info.st_mode), f'symlink forbidden: {path}')
        require(stat.S_ISREG(info.st_mode) if index == len(parts)-1 else stat.S_ISDIR(info.st_mode), f'not a regular file/path: {path}')
    return path


def inventory(root):
    entries = {}
    require(root.is_dir() and not root.is_symlink(), f'unsafe package root: {root}')
    for path in sorted(root.rglob('*')):
        require(not path.is_symlink(), f'symlink forbidden: {path}')
        if path.is_dir():
            continue
        name = path.relative_to(root).as_posix()
        entries[name] = regular(root, name).read_bytes()
    return entries


def sha(data):
    return hashlib.sha256(data).hexdigest()


def package_digest(files):
    digest = hashlib.sha256()
    for name, data in sorted(files.items()):
        digest.update(name.encode('utf-8') + b'\0' + data + b'\0')
    return digest.hexdigest()


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    loaded = importlib.util.module_from_spec(spec)
    sys.modules[name] = loaded
    spec.loader.exec_module(loaded)
    return loaded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--source-root', type=Path, required=True, help='Independently verified pinned Work-with-Agent source tree')
    args = parser.parse_args()
    root, source = args.root.absolute(), args.source_root.absolute()
    require(root.is_dir() and source.is_dir(), 'root/source directory missing')
    for top in (root, source):
        require('..' not in top.parts, 'traversal in root path')
        for ancestor in (top, *top.parents):
            require(not stat.S_ISLNK(os.lstat(ancestor).st_mode), f'symlink in root path: {ancestor}')
    from jsonschema import Draft202012Validator, FormatChecker
    formats = FormatChecker()
    require({'uri', 'date-time'} <= formats.checkers.keys(), 'required format checkers missing')
    installed = json.loads(regular(root, BASE+'package-inventory.json').read_text())
    require(installed['resolved_commit_sha'] == SOURCE_SHA and installed['source_repository_url'] == SOURCE_URL and installed['release_tag'] == 'v0.2.0', 'fixed-source metadata mismatch')
    expected_paths = {f'{client}/skills/{name}' for client in ('.agents', '.claude') for name in SKILLS}
    require({p['path'] for p in installed['packages']} == expected_paths and len(installed['packages']) == 6, 'six package inventory required')
    source_files = {}
    package_results = []
    for record in installed['packages']:
        name = record['name']
        require(name in SKILLS, 'unknown package')
        original = inventory(source/'skills'/name)
        actual = inventory(root/record['path'])
        require(actual == original, f'full package set or bytes drift: {record["path"]}')
        source_files[name] = original
        require(record['file_count'] == len(actual), 'package file count drift')
        require(record['package_sha256'] == package_digest(actual), 'package digest drift')
        require(record['files'] == [{'path':n, 'sha256':sha(b), 'bytes':len(b)} for n,b in sorted(actual.items())], 'inventory file digest drift')
        require(record['manifest_sha256'] == sha(actual['RESOURCE_MANIFEST.json']), 'manifest digest drift')
        manifest = json.loads(actual['RESOURCE_MANIFEST.json'])
        for resource in manifest['resources']:
            copied = actual[resource['destination']]
            canonical = regular(source, resource['source']).read_bytes()
            require(copied == canonical and sha(copied) == resource['copied_sha256'] == resource['source_sha256'], 'canonical/manifest resource mismatch')
        package_results.append({'path':record['path'], 'files':len(actual), 'sha256':record['package_sha256']})
    # Reviewed release tool verifies the canonical resource-set contract, links and syntax.
    sys.path.insert(0, str(source/'scripts'))
    canonical_verifier = module(regular(source, 'scripts/verify_skill_packages.py'), 'wwa_release_verifier')
    for name in SKILLS:
        failures = canonical_verifier.verify_skill(source/'skills'/name, source)
        require(not failures, '\n'.join(failures))
    archive = source/'source.tar.gz'
    archive_result = 'not supplied; complete source-tree comparison passed'
    if archive.exists():
        require(not archive.is_symlink() and sha(archive.read_bytes()) == installed['archive_sha256'], 'source archive digest drift')
        with tarfile.open(archive, 'r:gz') as tar:
            archived = {}
            for item in tar.getmembers():
                parts = PurePosixPath(item.name).parts
                if len(parts) > 1 and parts[1] == 'skills' and item.isfile():
                    archived['/'.join(parts[1:])] = tar.extractfile(item).read()
            for name, files in source_files.items():
                prefix = 'skills/'+name+'/'
                selected = {key[len(prefix):]:value for key,value in archived.items() if key.startswith(prefix)}
                require(selected == files, 'archive/source package mismatch: '+name)
        archive_result = installed['archive_sha256']
    # Use the exact same-version checker parser against real candidate text.
    checker_source = regular(source, 'skills/github-collaboration-setup/assets/templates/project/'+BASE+'check_pr_metadata.py')
    require(regular(root, BASE+'check_pr_metadata.py').read_bytes() == checker_source.read_bytes(), 'deployed parser differs from trusted release')
    checker = module(checker_source, 'wwa_candidate_checker')
    schemas = {}
    parsed = {}
    for name in ('config', 'authorization', 'managed-resources'):
        raw = regular(root, BASE+name+'.yml').read_text(encoding='utf-8')
        require('__SETUP_REQUIRED__' not in raw, 'placeholder in installed '+name)
        data = checker.restricted_yaml(raw)
        schema = json.loads(regular(source, 'schemas/'+name+'.schema.json').read_text())
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema, format_checker=formats).validate(data)
        parsed[name] = data
        schemas[name] = sha(raw.encode())
    cfg = parsed['config']
    for version in ('protocol_version', 'minimum_runtime_skill_version', 'setup_skill_version'):
        require(cfg[version] == '0.2.0', 'version drift')
    for key, value in cfg['managed_paths'].items():
        for rel in value if isinstance(value, list) else [value]:
            regular(root, rel)
    require(cfg['enforcement'] == {'actions_enabled':False, 'required_checks_enabled':False, 'rulesets_enabled':False}, 'unexpected governance enforcement activation')
    require(not (root/'.github/workflows').exists(), 'root workflows are outside this installation scope')
    require(parsed['authorization']['leader_delegations'] == [], 'no persistent Leader was approved for this installation')
    require(parsed['authorization']['repository'] == {'hostname':'github.com','repository_id':1351406548,'owner':'Paipai112','name':'static-pages','default_branch':'main','default_branch_source_sha':'0533d1ea1e71fe28553ed84a054b5b9e9d76531c'}, 'target identity mismatch')
    # Reject ambiguous raw YAML rather than silently accepting parsed dictionaries.
    rejected = ('a: 1\na: 2\n', 'a: &x yes\n', 'a: *x\n', 'a: !tag value\n', '---\na: 1\n', 'a: yes\n', 'a:\n  <<: x\n')
    for text in rejected:
        try:
            checker.restricted_yaml(text)
        except ValueError:
            pass
        else:
            raise ValueError('restricted parser accepted unsafe YAML')
    require(checker.restricted_yaml('a:\n- x\n') == checker.restricted_yaml('a:\n  - x\n'), 'supported list forms diverge')
    # Verify all deployed machine helpers against the setup package's complete template.
    helpers = ('check_pr_metadata.py','collect_pr_metadata.py','run_pr_metadata_check.py','collaboration_event.py','collaboration_scope.py','collaboration-event.schema.json','requirements-helpers.txt','METADATA_INPUT.md')
    for name in helpers:
        original = regular(source,'skills/github-collaboration-setup/assets/templates/project/'+BASE+name)
        require(regular(root,BASE+name).read_bytes() == original.read_bytes(), 'mixed deployed chain: '+name)
    renderer = module(regular(source, 'skills/github-collaboration-setup/scripts/managed_block.py'), 'wwa_managed_renderer')
    for name in ('AGENTS.md','CLAUDE.md','CONTRIBUTING.md'):
        before = regular(root,name).read_bytes()
        body = regular(source,'templates/managed-blocks/'+name+'.block').read_text()
        require(renderer.plan_managed_block(before,body,'0.2.0').candidate == before, 'entry block not idempotent: '+name)
    pr = '.github/PULL_REQUEST_TEMPLATE/agent-change.md'
    require(regular(root,pr).read_bytes() == regular(source,'templates/project/'+pr).read_bytes(), 'PR template drift')
    issue = '.github/ISSUE_TEMPLATE/agent-task.yml'
    expected_issue = regular(source,'templates/project/'+issue).read_text().replace('labels:\n  - agent-collaboration/task\n','')
    require(regular(root,issue).read_text() == expected_issue, 'Issue template customization differs')
    resources = parsed['managed-resources']['resources']
    ids = [r['stable_id'] for r in resources]
    require(len(ids) == len(set(ids)), 'duplicate managed resource')
    require(BASE+'authorization.yml' not in ids, 'authorization must remain outside automatic ownership')
    required = {p['path']+'/'+f['path'] for p in installed['packages'] for f in p['files']}
    required |= {BASE+n for n in helpers} | {'AGENTS.md','CLAUDE.md','CONTRIBUTING.md',pr,issue,BASE+'config.yml',BASE+'PROTOCOL.md',BASE+'README.md',BASE+'ROLES.md',BASE+'INSTALL_SKILL.md',BASE+'actors.yml',BASE+'package-inventory.json',BASE+'config.schema.json',BASE+'authorization.schema.json',BASE+'managed-resources.schema.json','NOTICE-WORK-WITH-AGENT.md','scripts/validate-work-with-agent.py'}
    require(set(ids) == required, 'incomplete or excessive governance baseline coverage')
    local_baselines = {r['baseline_reference'] for r in resources if not r['baseline_reference'].startswith('https://')}
    actual_baselines = {p.relative_to(root).as_posix() for p in (root/BASE/'baselines').iterdir()}
    require(actual_baselines == local_baselines, 'orphan or missing baseline snapshot')
    for record in resources:
        actual = regular(root, record['stable_id']).read_bytes()
        digest = 'sha256:'+sha(actual)
        require(digest == record['applied_digest'] == record['managed_fields_baseline_digest'], 'baseline/current digest drift: '+record['stable_id'])
        reference = record['baseline_reference']
        prefix = SOURCE_URL+'/blob/'+SOURCE_SHA+'/'
        baseline = regular(source,reference[len(prefix):]).read_bytes() if reference.startswith(prefix) else regular(root,reference).read_bytes()
        require(baseline == actual, 'unrecoverable baseline: '+record['stable_id'])
    print(json.dumps({'result':'pass','source_sha':SOURCE_SHA,'packages':package_results,'archive':archive_result,'strict_yaml_schema_sha256':schemas,'managed_resources':len(resources),'checks':['six full packages','canonical manifests','complete deployed chain','restricted YAML and formats','reject unsafe YAML','safe paths','managed block idempotence','recoverable baselines','no persistent Leader','no root Actions workflow'],'limits':['Offline consistency only; does not authenticate release/tag binding or current permissions.','Native client discovery and actual target PR formal check require separate evidence.','Registry and baseline snapshots record proposal bytes; no self-granted ownership or authorization.']},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, ImportError) as error:
        print('FAIL: '+str(error), file=sys.stderr)
        raise SystemExit(1)
