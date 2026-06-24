{
  description = "Telefoninho monorepo";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: {
    devShells.x86_64-linux.default = let
      pkgs = import nixpkgs {
        system = "x86_64-linux";
        config.allowUnfree = true;
        config.permittedInsecurePackages = [];
      };
      prismaEngines = pkgs."prisma-engines_7";
    in
      pkgs.mkShell {
        name = "telefoninho";
        ANDROID_HOME = builtins.getEnv "ANDROID_HOME";
        JAVA_HOME = "${pkgs.jdk17}/lib/openjdk";
        packages = with pkgs; [
          nodejs_22
          pnpm
          uv
          docker
          docker-compose
          jdk17
          gradle
          git
          typescript
          sqlite
          prisma_7
        ] ++ [ prismaEngines ];
        shellHook = ''
          echo "Telefoninho dev shell (Nix)"
          if [ -z "$ANDROID_HOME" ]; then
            export ANDROID_HOME="$HOME/Android/Sdk"
          fi
          export ANDROID_SDK_ROOT="$ANDROID_HOME"
          export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
          export NPM_CONFIG_STRICT_SSL=false
          export PRISMA_SCHEMA_ENGINE_BINARY="${prismaEngines}/bin/schema-engine"
          export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
          export DATABASE_URL="${if builtins.getEnv "DATABASE_URL" != "" then builtins.getEnv "DATABASE_URL" else "file:./dev.db"}"
        '';
      };
  };
}
