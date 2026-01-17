{
  description = "Orkestra - AI-native BPM orchestration backend";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js and package management
            nodejs_20
            nodePackages.pnpm

            # Docker
            docker
            docker-compose

            # Database tools
            postgresql_15

            # Prisma
            prisma-engines

            # Useful utilities
            jq
            curl
            git
          ];

          shellHook = ''
            echo "Orkestra development environment loaded"
            echo "Node.js: $(node --version)"
            echo "pnpm: $(pnpm --version)"
          '';
        };
      }
    );
}
