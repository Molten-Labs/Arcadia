{pkgs}: {
  deps = [
    pkgs.redis
    pkgs.openssl
    pkgs.pkg-config
    pkgs.cargo
    pkgs.rustc
  ];
}
