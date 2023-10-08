FROM rust:1.73

WORKDIR /src
COPY . .

RUN cargo install sqlx-cli --no-default-features --features mysql

RUN cargo sqlx prepare

RUN cargo build --release   

CMD ["./target/release/marketplace"]