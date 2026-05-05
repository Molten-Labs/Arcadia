use std::{
    env, fs,
    path::{Path, PathBuf},
    time::SystemTime,
};

pub fn assert_sbf_is_fresh(so_path: &Path) {
    if env::var_os("KILN_SKIP_SBF_FRESHNESS_CHECK").is_some() {
        return;
    }

    let so_mtime = fs::metadata(so_path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let program_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../program");
    let mut sources = vec![program_root.join("Cargo.toml")];
    collect_rust_sources(&program_root.join("src"), &mut sources);

    assert!(
        !sources.is_empty(),
        "no program sources found under {:?}",
        program_root.join("src")
    );

    for path in sources {
        let source_mtime = fs::metadata(&path)
            .and_then(|m| m.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        assert!(
            so_mtime >= source_mtime,
            "{:?} is older than {:?}; run cargo build-sbf or set KILN_SBF_PATH to a fresh artifact",
            so_path,
            path
        );
    }
}

fn collect_rust_sources(dir: &Path, sources: &mut Vec<PathBuf>) {
    let entries = fs::read_dir(dir)
        .unwrap_or_else(|err| panic!("failed to read program source directory {:?}: {}", dir, err));

    for entry in entries {
        let path = entry.expect("program source entry").path();
        if path.is_dir() {
            collect_rust_sources(&path, sources);
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
            sources.push(path);
        }
    }
}
