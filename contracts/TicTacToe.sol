// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

contract TicTacToe {
    enum Players {
        None,
        PlayerOne,
        PlayerTwo
    }

    address public gameMaster;

    mapping(uint256 => Players[3][3]) public boards;

    event Move(uint256 gameId, Players player, uint256 x, uint256 y);

    constructor(address gameMaster_) {
        gameMaster = gameMaster_;
    }

    /**
     * @notice Make move
     * @param gameId_: Id of game to make move
     * @param params_: Contains 2 elements. x and y coordinates
     */
    function makeMove(uint8 playerTurnn_, uint256 gameId_, uint256[] calldata params_) external returns (uint256) {
        require(msg.sender == gameMaster, "Only game master");
        
        Players playerTurn_ = Players(playerTurnn_);
        uint256 x = params_[0];
        uint256 y = params_[1];

        Players[3][3] storage board = boards[gameId_];

        require(board[x][y] == Players.None, "Field is already marked");

        board[x][y] = playerTurn_;

        emit Move(gameId_, playerTurn_, x, y);

        Players winner = calculateWinner(board);

        if (winner == Players.None) {
            if (isBoardFull(board)) {
                return 1;
            }
            return 0;
        } else return 2;
    }

    /**
     * @notice Function to get game board state
     */
    function getBoard(uint256 gameId_) external view returns (Players[3][3] memory) {
        return boards[gameId_];
    }

    /**
     * @notice Function to check if anyone wins
     * @param board_: Game board
     */
    function calculateWinner(Players[3][3] memory board_) private pure returns (Players winner) {
        for (uint256 x = 0; x < 3; x++) {
            if (board_[x][0] == board_[x][1] && board_[x][1] == board_[x][2] && board_[x][0] != Players.None) {
                return board_[x][0];
            }
        }

        for (uint256 y = 0; y < 3; y++) {
            if (board_[0][y] == board_[1][y] && board_[1][y] == board_[2][y] && board_[0][y] != Players.None) {
                return board_[0][y];
            }
        }

        if (board_[0][0] == board_[1][1] && board_[1][1] == board_[2][2] && board_[0][0] != Players.None) {
            return board_[0][0];
        } else if (board_[0][2] == board_[1][1] && board_[1][1] == board_[2][0] && board_[0][2] != Players.None) {
            return board_[0][2];
        }

        return Players.None;
    }

    /**
     * @notice Function to check if board is full
     * @param board_: Game board
     */
    function isBoardFull(Players[3][3] memory board_) private pure returns (bool) {
        for (uint256 x = 0; x < 3; x++) {
            for (uint256 y = 0; y < 3; y++) {
                if (board_[x][y] == Players.None) {
                    return false;
                }
            }
        }

        return true;
    }
}
